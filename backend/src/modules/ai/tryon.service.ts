import { HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBLE_PRODUCT } from '../catalog/catalog.service';
import { SettingsService } from '../settings/settings.service';

const MODEL = 'gemini-3-pro-image';
const RESULT_TTL_MS = 10 * 60 * 1000;
const PER_VISITOR = { perHour: 3, perDay: 8 };

type Job = { status: 'working' | 'done' | 'failed'; image?: Buffer; at: number };

/**
 * "Üzerimde gör": the visitor's photo plus our own product photos go to Gemini, which returns the visitor
 * carrying the bag. Nothing is written to disk: the photo lives only for the request, the result for ten
 * minutes in memory, then both are gone.
 */
@Injectable()
export class TryOnService {
  private readonly logger = new Logger(TryOnService.name);
  private readonly key: string;
  private readonly dailyLimit: number;
  private readonly uploadDir: string;
  private readonly publicBase: string;
  private readonly jobs = new Map<string, Job>();
  private readonly visitors = new Map<string, number[]>();
  private day = { date: '', count: 0 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    config: ConfigService<Env, true>,
  ) {
    this.key = config.get('GEMINI_API_KEY', { infer: true });
    this.dailyLimit = config.get('TRYON_DAILY_LIMIT', { infer: true });
    this.uploadDir = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.publicBase = config.get('UPLOAD_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  async start(photo: Buffer, slug: string, colorSlug: string | undefined, visitor: string) {
    const cfg = await this.settings.get('tryon');
    if (!this.key || !cfg.enabled) throw new ServiceUnavailableException('Sanal deneme şu anda kapalı');

    const product = await this.prisma.product.findFirst({
      where: { slug, ...VISIBLE_PRODUCT },
      include: { images: { orderBy: { sortOrder: 'asc' }, include: { color: true } } },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    const ofColour = product.images.filter((i) => !colorSlug || i.color?.slug === colorSlug);
    const refs: Buffer[] = [];
    for (const image of (ofColour.length ? ofColour : product.images).slice(0, 3)) {
      const data = await this.readUpload(image.url);
      if (data) refs.push(data);
    }
    if (!refs.length) throw new ServiceUnavailableException('Ürün görseli bulunamadı');

    // Re-encoding drops EXIF (location, device) and keeps the request small.
    const person = await sharp(photo).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();

    this.admit(visitor);
    const id = randomUUID();
    this.jobs.set(id, { status: 'working', at: Date.now() });
    const colour = ofColour[0]?.color?.name ?? '';
    void this.run(id, person, refs, `${product.name}${colour ? ` in ${colour}` : ''}`);
    return { id };
  }

  result(id: string) {
    this.sweep();
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('Sonuç bulunamadı ya da süresi doldu');
    return { status: job.status, image: job.image ? `data:image/jpeg;base64,${job.image.toString('base64')}` : null };
  }

  private async run(id: string, person: Buffer, refs: Buffer[], bag: string) {
    try {
      const image = await this.generate(person, refs, bag);
      this.jobs.set(id, { status: 'done', image: await this.watermark(image), at: Date.now() });
    } catch (e) {
      this.logger.warn(`Sanal deneme başarısız: ${e instanceof Error ? e.message : String(e)}`);
      this.jobs.set(id, { status: 'failed', at: Date.now() });
    }
  }

  private async generate(person: Buffer, refs: Buffer[], bag: string) {
    const prompt = `Image 1 is a photo of a person. The other images show one handbag: the MAEYJA ${bag}, handmade leather.

Edit image 1 so this person is naturally carrying exactly that bag — on the shoulder, in the hand or in the crook of the arm, whichever suits their pose — at a realistic size for their body. Reproduce the bag faithfully from the product photos: the same shape and proportions, leather colour and finish, zip, stitching, pull and strap. Light and shadow on the bag must match image 1.

Keep everything else in image 1 exactly as it is: the person's face, body, skin, hair, clothes, pose, the background, framing and colours. Do not beautify or change the person. Photorealistic. No text, no logo.`;
    const parts = [{ text: prompt }, ...[person, ...refs].map((data) => ({ inline_data: { mime_type: 'image/jpeg', data: data.toString('base64') } }))];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize: '1K' } } }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] };
    const blob = data.candidates?.flatMap((c) => c.content?.parts ?? []).find((p) => p.inlineData)?.inlineData;
    if (!blob) throw new Error('Gemini görsel döndürmedi');
    return Buffer.from(blob.data, 'base64');
  }

  /** A small "MAEYJA · AI" mark so a shared picture is never mistaken for a real photo. */
  private async watermark(image: Buffer) {
    const { width = 1024 } = await sharp(image).metadata();
    const size = Math.round(width * 0.022);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 14}" height="${size * 2.6}"><text x="50%" y="62%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" letter-spacing="${size * 0.25}" fill="white" fill-opacity="0.75">MAEYJA · AI</text></svg>`;
    return sharp(image).composite([{ input: Buffer.from(svg), gravity: 'southeast' }]).jpeg({ quality: 90 }).toBuffer();
  }

  /** Product photos are our own uploads; read them from disk instead of over the network. */
  private async readUpload(url: string): Promise<Buffer | null> {
    if (!url.startsWith(`${this.publicBase}/`)) return null;
    const path = join(this.uploadDir, url.slice(this.publicBase.length + 1));
    if (!path.startsWith(this.uploadDir)) return null;
    try {
      return await sharp(await readFile(path)).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    } catch {
      return null;
    }
  }

  /** 3 an hour and 8 a day per visitor, plus a daily ceiling for the store (each image is a paid request). */
  private admit(visitor: string) {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    if (this.day.date !== today) {
      this.day = { date: today, count: 0 };
      this.visitors.clear();
    }
    const mine = this.visitors.get(visitor) ?? [];
    if (this.day.count >= this.dailyLimit || mine.length >= PER_VISITOR.perDay || mine.filter((t) => now - t < 3_600_000).length >= PER_VISITOR.perHour) {
      throw new HttpException('Deneme sınırı doldu', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.visitors.set(visitor, [...mine, now]);
    this.day.count++;
  }

  private sweep() {
    const now = Date.now();
    for (const [id, job] of this.jobs) if (now - job.at > RESULT_TTL_MS) this.jobs.delete(id);
  }
}
