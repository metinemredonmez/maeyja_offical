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
      const ext = file.mimetype === 'video/webm' ? 'webm' : 'mp4';
      const key = `${folder}/${id}.${ext}`;
      await this.write(key, file.buffer);
      return this.prisma.media.create({
        data: { url: this.url(key), key, mimeType: file.mimetype, size: file.size, alt, uploadedById: userId },
      });
    }

    if (!IMAGE_TYPES.includes(file.mimetype)) throw new BadRequestException('Desteklenen türler: JPG, PNG, WebP, AVIF, MP4, WebM');

    // Re-encoding strips EXIF (incl. GPS) and normalises orientation.
    const image = sharp(file.buffer, { failOn: 'error' }).rotate();
    const meta = await image.metadata();
    if (!meta.width || !meta.height) throw new BadRequestException('Görsel okunamadı');

    const renditions: Record<string, string> = {};
    let largestKey = '';
    for (const width of WIDTHS.filter((w) => w <= meta.width! || w === WIDTHS[0])) {
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
