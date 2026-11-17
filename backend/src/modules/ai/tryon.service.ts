import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TryonAvatar } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import sharp from 'sharp';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBLE_PRODUCT } from '../catalog/catalog.service';
import { SettingsService } from '../settings/settings.service';
import { UsageService, visitorKey } from '../usage/usage.service';
import { AvatarChoice, avatarHeight, avatarKey, avatarPrompt } from './tryon-avatar';

const MODEL = 'gemini-3-pro-image';
const RESULT_TTL_MS = 10 * 60 * 1000;
const PER_VISITOR = { perHour: 3, perDay: 8 };
/** Store-wide per hour: a bot can't spend the day's budget in minutes. */
const HOURLY_SHARE = 1 / 6;
/** FIL-02: a decompression bomb is refused before it is decoded (about 6300 × 6300). */
const MAX_INPUT_PIXELS = 40_000_000;
/** Avatars and the bags on them live with the uploads, under this folder. */
const FOLDER = 'tryon';

type Job = { status: 'working' | 'done' | 'failed'; image?: Buffer; url?: string; at: number };
type Bag = { productId: string; slug: string; colour: string; refs: Buffer[]; description: string };

/**
 * "Üzerimde gör", two ways:
 * - the visitor's photo plus our own product photos go to Gemini, which returns the visitor carrying the bag. Nothing
 *   is written to disk: the photo lives only for the request, the result for ten minutes in memory;
 * - no photo: an avatar of the visitor's choices (tryon-avatar.ts) carries the bag. Avatars and the bags on them are
 *   our own pictures, kept with the uploads and reused by everyone who picks the same, so a repeat costs nothing.
 */
@Injectable()
export class TryOnService {
  private readonly logger = new Logger(TryOnService.name);
  private readonly key: string;
  private readonly dailyLimit: number;
  private readonly uploadDir: string;
  private readonly publicBase: string;
  private readonly jobs = new Map<string, Job>();
  /** Two visitors asking for the same new avatar at once share one run. */
  private readonly avatarRuns = new Map<string, Promise<TryonAvatar>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly usage: UsageService,
    config: ConfigService<Env, true>,
  ) {
    this.key = config.get('GEMINI_API_KEY', { infer: true });
    this.dailyLimit = config.get('TRYON_DAILY_LIMIT', { infer: true });
    this.uploadDir = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.publicBase = config.get('UPLOAD_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  async start(photo: Buffer, slug: string, colorSlug: string | undefined, visitor: string) {
    const bag = await this.bag(slug, colorSlug);

    // Counted before the photo is decoded, so refused requests cost nothing.
    await this.admit(visitor);
    // Re-encoding drops EXIF (location, device) and keeps the request small.
    const person = await sharp(photo, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer()
      .catch(() => {
        throw new BadRequestException('Fotoğraf okunamadı; JPEG, PNG ya da WebP yükleyin');
      });

    const id = randomUUID();
    this.jobs.set(id, { status: 'working', at: Date.now() });
    void this.run(id, person, bag);
    return { id };
  }

  /** No photo: the avatar of these choices carries the bag. A look made before comes back at once, free. */
  async startAvatar(choice: AvatarChoice, slug: string, colorSlug: string | undefined, visitor: string) {
    const bag = await this.bag(slug, colorSlug);
    const key = avatarKey(choice);
    const made = await this.prisma.tryonLook.findFirst({ where: { productId: bag.productId, colorSlug: bag.colour, avatar: { key } } });
    if (made) return { id: null, status: 'done' as const, image: made.imageUrl };

    await this.admit(visitor);
    const id = randomUUID();
    this.jobs.set(id, { status: 'working', at: Date.now() });
    void this.runAvatar(id, choice, key, bag);
    return { id, status: 'working' as const, image: null };
  }

  result(id: string) {
    this.sweep();
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('Sonuç bulunamadı ya da süresi doldu');
    return { status: job.status, image: job.url ?? (job.image ? `data:image/jpeg;base64,${job.image.toString('base64')}` : null) };
  }

  // ───────── admin (AI stüdyo → Deneme avatarları) ─────────

  avatars() {
    return this.prisma.tryonAvatar.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { looks: true } } } });
  }

  /** The avatar and every bag on it go; the next visitor who picks the same gets a new one. */
  async removeAvatar(id: string) {
    const avatar = await this.prisma.tryonAvatar.findUnique({ where: { id }, include: { looks: true } });
    if (!avatar) throw new NotFoundException('Avatar bulunamadı');
    await this.prisma.tryonAvatar.delete({ where: { id } });
    await Promise.all([avatar.imageUrl, ...avatar.looks.map((l) => l.imageUrl)].map((url) => this.removeFile(url)));
    return { ok: true };
  }

  /** After the product photos change: every bag is placed again on its next request (the avatars stay). */
  async removeLooks() {
    const looks = await this.prisma.tryonLook.findMany({ select: { imageUrl: true } });
    await this.prisma.tryonLook.deleteMany({});
    await Promise.all(looks.map((l) => this.removeFile(l.imageUrl)));
    return { removed: looks.length };
  }

  // ───────── generation ─────────

  private async run(id: string, person: Buffer, bag: Bag) {
    try {
      const image = await this.placeBag(person, bag);
      this.jobs.set(id, { status: 'done', image: await this.watermark(image), at: Date.now() });
    } catch (e) {
      this.logger.warn(`Sanal deneme başarısız: ${e instanceof Error ? e.message : String(e)}`);
      this.jobs.set(id, { status: 'failed', at: Date.now() });
    }
  }

  private async runAvatar(id: string, choice: AvatarChoice, key: string, bag: Bag) {
    try {
      const avatar = await this.avatar(choice, key);
      const person = await this.readUpload(avatar.imageUrl);
      if (!person) throw new Error('avatar görseli okunamadı');
      const image = await this.watermark(await this.placeBag(person, bag, `The person is about ${avatarHeight(choice.height)} cm tall.`));
      const url = await this.save(`looks/${key}--${bag.slug}--${bag.colour || 'all'}`, image);
      await this.prisma.tryonLook.upsert({
        where: { avatarId_productId_colorSlug: { avatarId: avatar.id, productId: bag.productId, colorSlug: bag.colour } },
        create: { avatarId: avatar.id, productId: bag.productId, colorSlug: bag.colour, imageUrl: url },
        update: { imageUrl: url },
      });
      this.jobs.set(id, { status: 'done', url, at: Date.now() });
    } catch (e) {
      this.logger.warn(`Avatarlı deneme başarısız: ${e instanceof Error ? e.message : String(e)}`);
      this.jobs.set(id, { status: 'failed', at: Date.now() });
    }
  }

  private avatar(choice: AvatarChoice, key: string): Promise<TryonAvatar> {
    const running = this.avatarRuns.get(key);
    if (running) return running;
    const run = (async () => {
      const found = await this.prisma.tryonAvatar.findUnique({ where: { key } });
      if (found) return found;
      const image = await this.gemini([{ text: avatarPrompt(choice) }], '3:4');
      const url = await this.save(`avatars/${key}`, await sharp(image).jpeg({ quality: 90 }).toBuffer());
      return this.prisma.tryonAvatar.create({ data: { key, imageUrl: url } });
    })().finally(() => this.avatarRuns.delete(key));
    this.avatarRuns.set(key, run);
    return run;
  }

  private placeBag(person: Buffer, bag: Bag, scale = '') {
    const prompt = `Image 1 is a photo of a person. The other images show one handbag: the MAEYJA ${bag.description}, handmade leather.

Edit image 1 so this person is naturally carrying exactly that bag — on the shoulder, in the hand or in the crook of the arm, whichever suits their pose — at a realistic size for their body.${scale ? ` ${scale}` : ''} Reproduce the bag faithfully from the product photos: the same shape and proportions, leather colour and finish, zip, stitching, pull and strap. Light and shadow on the bag must match image 1.

Keep everything else in image 1 exactly as it is: the person's face, body, skin, hair, clothes, pose, the background, framing and colours. Do not beautify or change the person. Photorealistic. No text, no logo.`;
    return this.gemini([{ text: prompt }, ...[person, ...bag.refs].map((data) => ({ inline_data: { mime_type: 'image/jpeg', data: data.toString('base64') } }))]);
  }

  private async gemini(parts: object[], aspectRatio?: string) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize: '1K', ...(aspectRatio ? { aspectRatio } : {}) } } }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] };
    const blob = data.candidates?.flatMap((c) => c.content?.parts ?? []).find((p) => p.inlineData)?.inlineData;
    if (!blob) throw new Error('Gemini görsel döndürmedi');
    return Buffer.from(blob.data, 'base64');
  }

  /** The product and up to three of its photos (of the chosen colour), checked before anything is counted. */
  private async bag(slug: string, colorSlug: string | undefined): Promise<Bag> {
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
    const colour = ofColour.length && colorSlug ? (ofColour[0].color?.slug ?? '') : '';
    const name = ofColour[0]?.color?.name ?? '';
    // Its real size, so the bag sits at the right scale on the body.
    const size = product.dimensions ? `, which measures ${product.dimensions}` : '';
    return { productId: product.id, slug: product.slug, colour, refs, description: `${product.name}${name ? ` in ${name}` : ''}${size}` };
  }

  /** A small "MAEYJA · AI" mark so a shared picture is never mistaken for a real photo. */
  private async watermark(image: Buffer) {
    const { width = 1024 } = await sharp(image).metadata();
    const size = Math.round(width * 0.022);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 14}" height="${size * 2.6}"><text x="50%" y="62%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${size}" letter-spacing="${size * 0.25}" fill="white" fill-opacity="0.75">MAEYJA · AI</text></svg>`;
    return sharp(image).composite([{ input: Buffer.from(svg), gravity: 'southeast' }]).jpeg({ quality: 90 }).toBuffer();
  }

  /** Under the uploads; the name ends in a stamp so a picture made again never shows the old one from a cache. */
  private async save(name: string, image: Buffer) {
    const rel = `${FOLDER}/${name}-${Date.now().toString(36)}.jpg`;
    const path = join(this.uploadDir, rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, image);
    return `${this.publicBase}/${rel}`;
  }

  private async removeFile(url: string) {
    if (!url.startsWith(`${this.publicBase}/${FOLDER}/`)) return;
    const path = join(this.uploadDir, url.slice(this.publicBase.length + 1));
    if (path.startsWith(join(this.uploadDir, FOLDER))) await unlink(path).catch(() => undefined);
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

  /** RES-01: 3 an hour and 8 a day per visitor, plus hourly and daily ceilings for the store (each image is a paid request). */
  private async admit(visitor: string) {
    const v = visitorKey(visitor);
    const hourly = Math.max(5, Math.round(this.dailyLimit * HOURLY_SHARE));
    const ok =
      (await this.usage.take(`tryon:v:${v}:hour`, PER_VISITOR.perHour, 3600_000)) &&
      (await this.usage.take(`tryon:v:${v}:day`, PER_VISITOR.perDay, 86400_000)) &&
      (await this.usage.take('tryon:hour', hourly, 3600_000)) &&
      (await this.usage.takeDaily('tryon', this.dailyLimit, 'Üzerimde gör'));
    if (!ok) throw new HttpException('Deneme sınırı doldu', HttpStatus.TOO_MANY_REQUESTS);
  }

  private sweep() {
    const now = Date.now();
    for (const [id, job] of this.jobs) if (now - job.at > RESULT_TTL_MS) this.jobs.delete(id);
  }
}
