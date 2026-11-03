import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import sharp from 'sharp';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const WIDTHS = [400, 800, 1600, 2400];
/** FIL-01: what the bytes must be, whatever the browser called the file (sharp's names; AVIF reads as heif). */
const IMAGE_FORMATS = ['jpeg', 'png', 'webp', 'heif'];
/** FIL-02: decompression bombs are refused before decoding (about 8000 × 8000), and no resize may run away. */
const MAX_INPUT_PIXELS = 64_000_000;
const SHARP_TIMEOUT = { seconds: 30 };

/** FIL-01: MP4 has "ftyp" at byte 4, WebM starts with the EBML magic 1A 45 DF A3. */
export function videoMatches(mimetype: string, buf: Buffer) {
  if (mimetype === 'video/mp4') return buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp';
  return buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly root: string;
  private readonly publicBase: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.publicBase = config.get('UPLOAD_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  async upload(file: Express.Multer.File | undefined, alt: string | undefined, userId: string) {
    if (!file) throw new BadRequestException('Dosya gerekli (form alanı: file)');
    const now = new Date();
    const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const id = randomBytes(8).toString('hex');

    if (VIDEO_TYPES.includes(file.mimetype)) {
      if (!videoMatches(file.mimetype, file.buffer)) throw new BadRequestException('Dosya bir MP4/WebM videosu değil');
      const ext = file.mimetype === 'video/webm' ? 'webm' : 'mp4';
      const key = `${folder}/${id}.${ext}`;
      await this.write(key, file.buffer);
      return this.prisma.media.create({
        data: { url: this.url(key), key, mimeType: file.mimetype, size: file.size, alt, uploadedById: userId },
      });
    }

    if (!IMAGE_TYPES.includes(file.mimetype)) throw new BadRequestException('Desteklenen türler: JPG, PNG, WebP, AVIF, MP4, WebM');

    // Re-encoding strips EXIF (incl. GPS) and normalises orientation.
    const image = sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate().timeout(SHARP_TIMEOUT);
    const meta = await image.metadata().catch(() => {
      throw new BadRequestException('Görsel okunamadı ya da çok büyük (en fazla yaklaşık 8000 × 8000 piksel)');
    });
    // An SVG, GIF or TIFF renamed to .jpg is refused here: only the formats we expect are decoded.
    if (!meta.format || !IMAGE_FORMATS.includes(meta.format)) throw new BadRequestException('Desteklenen türler: JPG, PNG, WebP, AVIF');
    if (!meta.width || !meta.height) throw new BadRequestException('Görsel okunamadı');

    const renditions: Record<string, string> = {};
    let largestKey = '';
    // Standard widths below the source plus the source itself (capped): a 600px photo keeps a 600px rendition.
    const widths = [...new Set([...WIDTHS.filter((w) => w < meta.width!), Math.min(meta.width!, WIDTHS[WIDTHS.length - 1])])];
    for (const width of widths) {
      const key = `${folder}/${id}-${width}.webp`;
      const buffer = await image.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      await this.write(key, buffer);
      renditions[String(width)] = this.url(key);
      largestKey = key;
    }

    return this.prisma.media.create({
      data: {
        url: this.url(largestKey),
        key: largestKey,
        mimeType: 'image/webp',
        size: file.size,
        width: meta.width,
        height: meta.height,
        alt,
        renditions,
        uploadedById: userId,
      },
    });
  }

  async list(q: PaginationQueryDto) {
    const where = q.q ? { alt: { contains: q.q, mode: 'insensitive' as const } } : {};
    const [items, total] = await Promise.all([
      this.prisma.media.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.media.count({ where }),
    ]);
    return paginate(items, total, q.page, q.limit);
  }

  updateAlt(id: string, alt: string) {
    return this.prisma.media.update({ where: { id }, data: { alt } });
  }

  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Dosya bulunamadı');
    const keys = media.renditions
      ? Object.values(media.renditions as Record<string, string>).map((u) => u.replace(`${this.publicBase}/`, ''))
      : [media.key];
    await Promise.all(keys.map((k) => unlink(this.safePath(k)).catch(() => undefined)));
    await this.prisma.media.delete({ where: { id } });
    return { ok: true };
  }

  private async write(key: string, buffer: Buffer) {
    const path = this.safePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  private safePath(key: string) {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root)) throw new BadRequestException('Geçersiz dosya yolu');
    return path;
  }

  private url(key: string) {
    return `${this.publicBase}/${key}`;
  }
}
