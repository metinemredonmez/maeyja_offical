import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HomeSectionType } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import sharp from 'sharp';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { SettingsService } from '../settings/settings.service';

export const STUDIO_KINDS = ['model', 'scene', 'video'] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number];
export const CARRY = ['auto', 'hand', 'strap', 'shoulder', 'underarm'] as const;
export type Carry = (typeof CARRY)[number];

const IMAGE_MODEL = 'gemini-3-pro-image';
const VIDEO_MODEL = 'gemini-omni-1.1-flash';
/** Each result is a paid request: a ceiling per day for the whole store (a runaway loop can't empty the credit). */
const DAILY = { image: 300, video: 40 };
/** Aspect ratios the image model accepts; a background edit keeps the source photo's own. */
const ASPECTS = ['1:1', '4:5', '5:4', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9'] as const;
const DEFAULT_SCENE = 'pale travertine stone under the bag, and behind it a warm plaster wall, in warm late-afternoon sunlight from the left with a soft window shadow';
const JOB_TTL_MS = 60 * 60 * 1000;

type Job = { status: 'working' | 'done' | 'failed'; suggestionId?: string; error?: string; at: number };

const HOW: Record<Carry, string> = {
  auto: 'carried the way this bag is meant to be carried, judged from its handles and straps in the photos',
  hand: 'in her right hand by its own top handle(s), her arm relaxed down by her side, her fingers really passing through the handle and curling around it',
  strap: 'in her right hand by its short strap gripped in her fist, the bag hanging directly under her hand',
  shoulder: 'on her right shoulder by its strap, the bag hanging at her waist against her side, both arms relaxed down, her hands not touching the strap',
  underarm: 'on her right shoulder by its short handle, the bag tucked under her arm close to her body',
};

const FIDELITY = `Keep the bag exactly as in the product photos: the same shape and proportions, the same leather and colour, the same zip, zip pulls, stitching and hardware. Do not add, remove, lengthen, shorten or reshape any handle, strap or chain, and do not add logos or charms.`;

/**
 * The admin's AI studio: from a product photo it makes an on-model photo (the studio grey of the product pages),
 * the same photo on another background described in words ("on a walnut table…"), or a short video. Every result is saved like an upload and waits as a
 * suggestion: added to the product, put on the homepage as a banner, or dismissed — nothing reaches the shop by
 * itself. New products get an on-model suggestion of their own.
 */
@Injectable()
export class AiStudioService {
  private readonly logger = new Logger(AiStudioService.name);
  private readonly key: string;
  private readonly root: string;
  private readonly publicBase: string;
  private readonly jobs = new Map<string, Job>();
  private day = { date: '', image: 0, video: 0 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly alerts: AlertsService,
    config: ConfigService<Env, true>,
  ) {
    this.key = config.get('GEMINI_API_KEY', { infer: true });
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.publicBase = config.get('UPLOAD_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  async start(input: { kind: StudioKind; imageUrl: string; productId?: string; carry?: Carry; note?: string }, auto = false) {
    if (!this.key) throw new ServiceUnavailableException('GEMINI_API_KEY tanımlı değil');
    const source = await this.readUpload(input.imageUrl);
    if (!source) throw new BadRequestException('Görsel bu sitenin yüklemelerinden olmalı');
    const product = input.productId
      ? await this.prisma.product.findUnique({ where: { id: input.productId }, include: { images: { orderBy: { sortOrder: 'asc' } } } })
      : null;
    if (input.productId && !product) throw new NotFoundException('Ürün bulunamadı');
    this.admit(input.kind === 'video' ? 'video' : 'image');

    const id = randomUUID();
    this.jobs.set(id, { status: 'working', at: Date.now() });
    void this.run(id, input, source, product, auto);
    return { id };
  }

  status(id: string) {
    this.sweep();
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException('İş bulunamadı ya da süresi doldu');
    return job;
  }

  suggestions(productId?: string, status = 'pending') {
    return this.prisma.aiSuggestion.findMany({
      where: { ...(productId ? { productId } : {}), ...(status === 'all' ? {} : { status }) },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
  }

  /** Adds the result to the product's photos (at the end; the on-model photo stays off the listing cards). */
  async addToProduct(id: string, productId?: string) {
    const s = await this.pending(id);
    const pid = productId ?? s.productId;
    if (!pid) throw new BadRequestException('Ürün seçilmedi');
    if (s.kind === 'video') throw new BadRequestException('Video ürün fotoğrafı olamaz; banner olarak ekleyin');
    const product = await this.prisma.product.findUnique({ where: { id: pid }, include: { images: { orderBy: { sortOrder: 'desc' }, take: 1 } } });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    await this.prisma.$transaction([
      this.prisma.productImage.create({
        data: { productId: pid, url: s.url, width: s.width, height: s.height, alt: product.name, sortOrder: (product.images[0]?.sortOrder ?? -1) + 1, colorId: product.images[0]?.colorId ?? null },
      }),
      this.prisma.aiSuggestion.update({ where: { id }, data: { status: 'added', productId: pid } }),
    ]);
    return { ok: true };
  }

  /** Puts the result on the homepage as a full-width banner (photo, or film with the source photo as its poster). */
  async addAsBanner(id: string) {
    const s = await this.pending(id);
    const last = await this.prisma.homeSection.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    const video = s.kind === 'video';
    const section = await this.prisma.homeSection.create({
      data: {
        type: HomeSectionType.EDITORIAL,
        layout: 'full',
        imageUrl: video ? s.sourceUrl : s.url,
        videoUrl: video ? s.url : null,
        isActive: true,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        payload: { productIds: s.productId ? [s.productId] : [] },
      },
    });
    await this.prisma.aiSuggestion.update({ where: { id }, data: { status: 'banner' } });
    return section;
  }

  /** Used directly in a form (e.g. a homepage section's video field). */
  async markUsed(id: string) {
    await this.pending(id);
    await this.prisma.aiSuggestion.update({ where: { id }, data: { status: 'added' } });
    return { ok: true };
  }

  async dismiss(id: string) {
    await this.pending(id);
    await this.prisma.aiSuggestion.update({ where: { id }, data: { status: 'dismissed' } });
    return { ok: true };
  }

  /** New products: one on-model suggestion each (from the first photo), waiting for approval. A few per run. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async suggestForNewProducts() {
    if (!this.key || !(await this.settings.get('aiStudio')).autoModel) return;
    const candidates = await this.prisma.product.findMany({
      where: { deletedAt: null, images: { some: {} }, NOT: { images: { some: { url: { contains: '-on-model' } } } } },
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    let started = 0;
    for (const p of candidates) {
      if (started >= 2) break;
      if (await this.prisma.aiSuggestion.count({ where: { productId: p.id, kind: 'model' } })) continue;
      try {
        await this.start({ kind: 'model', imageUrl: p.images[0].url, productId: p.id, carry: 'auto' }, true);
        started++;
      } catch (e) {
        this.logger.warn(`Otomatik manken önerisi başlamadı (${p.slug}): ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }
  }

  private async run(id: string, input: { kind: StudioKind; imageUrl: string; productId?: string; carry?: Carry; note?: string }, source: Buffer, product: { id: string; name: string; dimensions: string | null; images: { url: string }[] } | null, auto: boolean) {
    try {
      let saved: { url: string; mimeType: string; width?: number; height?: number };
      if (input.kind === 'video') {
        const { width = 16, height = 9 } = await sharp(source).metadata();
        const mp4 = await this.video(source, width >= height ? '16:9' : '9:16', input.note);
        saved = await this.save(mp4, 'video');
      } else {
        const refs = [source];
        for (const img of product?.images ?? []) {
          if (refs.length >= 3 || img.url === input.imageUrl) continue;
          const extra = await this.readUpload(img.url);
          if (extra) refs.push(extra);
        }
        const image = await this.image(this.prompt(input, product), refs, input.kind === 'scene' ? await this.aspectOf(source) : '4:5');
        saved = await this.save(image, input.kind === 'model' ? 'on-model' : 'scene');
      }
      const suggestion = await this.prisma.aiSuggestion.create({
        data: { productId: product?.id ?? null, kind: input.kind, url: saved.url, mimeType: saved.mimeType, width: saved.width, height: saved.height, sourceUrl: input.imageUrl, auto },
      });
      this.jobs.set(id, { status: 'done', suggestionId: suggestion.id, at: Date.now() });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`AI stüdyo (${input.kind}) başarısız: ${message}`);
      this.jobs.set(id, { status: 'failed', error: message.slice(0, 300), at: Date.now() });
    }
  }

  private prompt(input: { kind: StudioKind; carry?: Carry; note?: string }, product: { name: string; dimensions: string | null } | null) {
    const bag = product ? `the ${product.name} bag` : 'the bag';
    const size = product?.dimensions ? ` Its real size: ${product.dimensions.replace(/\s+/g, ' ')} — draw it at that size on her body.` : '';
    const note = input.note?.trim() ? `\nAlso: ${input.note.trim()}` : '';
    if (input.kind === 'scene') {
      const scene = input.note?.trim() || DEFAULT_SCENE;
      return `Edit this product photo. Keep the bag pixel-identical: the same size and position in the frame, the same crop and angle; do not zoom out and do not complete anything cut off by the edge of the photo. ${FIDELITY}
Change only the background and the surface the bag rests on, to this: ${scene}.
It must look like a real photograph: the light on the new background matches the light on the bag, and the bag keeps a soft, natural contact shadow where it touches the surface. No text, no other bags, no people unless asked for above, no Istanbul landmarks.`;
    }
    return `Full-length fashion e-commerce photo for MAEYJA, a luxury handmade leather bag brand, like the on-model shot on a designer bag product page.
A seamless plain studio: flat, even light grey background and floor, colour exactly #F2F2F2, soft even studio light, no props.
A slim woman in her late twenties with dark hair pulled back, natural make-up, wearing a black tailored blazer, wide black trousers and black shoes, standing relaxed, body turned slightly to the side, looking at the camera. The pose and hands look completely natural.
She carries ${bag} from the reference photos ${HOW[input.carry ?? 'auto']}.${size}
${FIDELITY}
No text, no logo other than the one on the bag, no other objects. Portrait 4:5.${note}`;
  }

  private async image(prompt: string, refs: Buffer[], aspect: string) {
    const parts = [{ text: prompt }, ...refs.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data: data.toString('base64') } }))];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect, imageSize: '2K' } } }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] };
    const blob = data.candidates?.flatMap((c) => c.content?.parts ?? []).find((p) => p.inlineData)?.inlineData;
    if (!blob) throw new Error('Gemini görsel döndürmedi');
    return Buffer.from(blob.data, 'base64');
  }

  /** Image-to-video (Gemini Omni, Interactions API): a calm, locked-off shot in which the bag doesn't change. */
  private async video(source: Buffer, aspect: '16:9' | '9:16', note?: string) {
    const prompt = `A calm, cinematic fashion shot made from this photo. Locked-off camera, no zoom. Gentle natural motion only: a little wind in hair and fabric, soft changes of light, breathing. The bag keeps exactly its shape, size, colour, hardware, handles and straps throughout — it never grows, changes shape or gains handles. No text, no music.${note?.trim() ? ` Also: ${note.trim()}` : ''}`;
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        input: [
          { type: 'image', data: source.toString('base64'), mime_type: 'image/jpeg' },
          { type: 'text', text: prompt },
        ],
        response_format: { type: 'video', aspect_ratio: aspect, resolution: '1080p' },
        generation_config: { video_config: { task: 'image_to_video' } },
      }),
      signal: AbortSignal.timeout(900_000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { steps?: { type: string; content?: { type: string; data?: string }[] }[] };
    const video = data.steps?.filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []).find((c) => c.type === 'video' && c.data);
    if (!video?.data) throw new Error('Gemini video döndürmedi');
    return Buffer.from(video.data, 'base64');
  }

  /** Saved like an admin upload (and listed in the media library); on-model photos carry "-on-model" in the name. */
  private async save(data: Buffer, tag: 'on-model' | 'scene' | 'video') {
    const now = new Date();
    const folder = `ai/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const id = randomBytes(8).toString('hex');
    if (tag === 'video') {
      const key = `${folder}/${id}-video.mp4`;
      await this.write(key, data);
      await this.prisma.media.create({ data: { url: `${this.publicBase}/${key}`, key, mimeType: 'video/mp4', size: data.length, alt: 'AI' } });
      return { url: `${this.publicBase}/${key}`, mimeType: 'video/mp4' };
    }
    const image = sharp(data).rotate();
    const { width = 0, height = 0 } = await image.metadata();
    const renditions: Record<string, string> = {};
    let key = '';
    for (const w of [...new Set([800, 1600].filter((x) => x < width).concat(Math.min(width, 1600)))]) {
      key = `${folder}/${id}-${tag}-${w}.webp`;
      await this.write(key, await image.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer());
      renditions[String(w)] = `${this.publicBase}/${key}`;
    }
    const scale = Math.min(1, 1600 / width);
    await this.prisma.media.create({ data: { url: `${this.publicBase}/${key}`, key, mimeType: 'image/webp', size: data.length, width, height, alt: 'AI', renditions } });
    return { url: `${this.publicBase}/${key}`, mimeType: 'image/webp', width: Math.round(width * scale), height: Math.round(height * scale) };
  }

  private async write(key: string, data: Buffer) {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root)) throw new BadRequestException('Geçersiz dosya yolu');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  private async pending(id: string) {
    const s = await this.prisma.aiSuggestion.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Öneri bulunamadı');
    return s;
  }

  /** The supported aspect ratio closest to the photo's own. */
  private async aspectOf(source: Buffer) {
    const { width = 4, height = 5 } = await sharp(source).metadata();
    const ratio = width / height;
    return ASPECTS.reduce((best, a) => {
      const [w, h] = a.split(':').map(Number);
      const [bw, bh] = best.split(':').map(Number);
      return Math.abs(Math.log(w / h / ratio)) < Math.abs(Math.log(bw / bh / ratio)) ? a : best;
    }, '1:1' as string);
  }

  /** Our own uploads, read from disk (no other address is accepted); a path like /uploads/… counts too. */
  private async readUpload(url: string): Promise<Buffer | null> {
    const basePath = this.publicBase.replace(/^https?:\/\/[^/]+/, '');
    const rel = url.startsWith(`${this.publicBase}/`) ? url.slice(this.publicBase.length + 1) : url.startsWith(`${basePath}/`) ? url.slice(basePath.length + 1) : null;
    if (rel === null) return null;
    const path = resolve(join(this.root, rel));
    if (!path.startsWith(this.root)) return null;
    try {
      return await sharp(await readFile(path)).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
    } catch {
      return null;
    }
  }

  private admit(kind: 'image' | 'video') {
    const today = new Date().toISOString().slice(0, 10);
    if (this.day.date !== today) this.day = { date: today, image: 0, video: 0 };
    if (this.day[kind] >= DAILY[kind]) {
      void this.alerts.raise('quota.reached', `AI stüdyo: bugünkü ${kind === 'video' ? 'video' : 'görsel'} sınırı (${DAILY[kind]}) doldu.`, { key: `ai-studio:${kind}` });
      throw new HttpException(`Bugünlük ${kind === 'video' ? 'video' : 'görsel'} sınırı doldu (${DAILY[kind]}); yarın yeniden deneyin`, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.day[kind]++;
  }

  private sweep() {
    const now = Date.now();
    for (const [id, job] of this.jobs) if (now - job.at > JOB_TTL_MS && job.status !== 'working') this.jobs.delete(id);
  }
}
