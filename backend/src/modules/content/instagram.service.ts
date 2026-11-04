import { BadRequestException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { access, mkdir, readFile, readdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { Tracked } from '../cron/tracked.decorator';

const GRAPH = 'https://graph.instagram.com';
/** Internal setting row (not one of the admin settings, so it is never listed or exposed). */
const KEY = 'instagramFeed';
const POSTS = 7;
const REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

export type InstagramPost = { id: string; image: string; permalink: string };
type Feed = { token?: string; envHash?: string; refreshedAt?: number; syncedAt?: number; posts: InstagramPost[] };
type Media = { id: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string };

const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

/**
 * The home page's "Follow us on Instagram" pictures come from the shop's own account (Instagram API with
 * Instagram Login). Every hour the latest posts are copied into our uploads — Instagram's image links expire —
 * and the long-lived token (60 days) is refreshed weekly so it never lapses. Without INSTAGRAM_ACCESS_TOKEN
 * nothing happens and the storefront keeps its campaign pictures.
 */
@Injectable()
export class InstagramService implements OnModuleInit {
  private readonly logger = new Logger(InstagramService.name);
  private readonly envToken: string;
  private readonly dir: string;
  private readonly root: string;
  private readonly publicBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    config: ConfigService<Env, true>,
  ) {
    this.envToken = config.get('INSTAGRAM_ACCESS_TOKEN', { infer: true });
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.dir = join(this.root, 'instagram');
    this.publicBase = config.get('UPLOAD_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  onModuleInit() {
    void this.sync();
  }

  async posts(): Promise<InstagramPost[]> {
    return (await this.read()).posts;
  }

  @Cron(CronExpression.EVERY_HOUR)
  @Tracked('instagram.sync', { label: 'Instagram akışı', everyMin: 60 })
  async sync() {
    if (!this.envToken) return;
    try {
      const feed = await this.read();
      // A token pasted into .env again (say, after reconnecting the account) replaces the stored, refreshed one.
      const envHash = hash(this.envToken);
      const fresh = feed.envHash !== envHash || !feed.token;
      let token = fresh ? this.envToken : feed.token!;
      let refreshedAt = fresh ? Date.now() : (feed.refreshedAt ?? 0);
      if (Date.now() - refreshedAt > REFRESH_EVERY_MS) {
        token = (await this.call<{ access_token: string }>('refresh_access_token', { grant_type: 'ig_refresh_token', access_token: token })).access_token;
        refreshedAt = Date.now();
      }

      const media = await this.call<{ data: Media[] }>('me/media', { fields: 'id,media_type,media_url,thumbnail_url,permalink', limit: '20', access_token: token });
      await mkdir(this.dir, { recursive: true });
      const posts: InstagramPost[] = [];
      for (const m of media.data) {
        if (posts.length === POSTS) break;
        const src = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
        if (!src) continue;
        const file = `${m.id.replace(/\D/g, '')}.webp`;
        if (!(await access(join(this.dir, file)).then(() => true, () => false))) {
          const res = await fetch(src, { signal: AbortSignal.timeout(30_000) });
          if (!res.ok) continue;
          // The collage frames are 4:5; crop once here instead of in every browser.
          await writeFile(join(this.dir, file), await sharp(Buffer.from(await res.arrayBuffer())).resize(800, 1000, { fit: 'cover' }).webp({ quality: 82 }).toBuffer());
        }
        posts.push({ id: m.id, image: `${this.publicBase}/instagram/${file}`, permalink: m.permalink });
      }
      for (const f of await readdir(this.dir)) {
        if (!posts.some((p) => p.image.endsWith(`/${f}`))) await unlink(join(this.dir, f)).catch(() => undefined);
      }
      await this.write({ token, envHash, refreshedAt, syncedAt: Date.now(), posts });
      void this.alerts.clear('instagram.sync_failed');
    } catch (e) {
      this.logger.warn(`Instagram eşitlenemedi: ${e instanceof Error ? e.message : String(e)}`);
      void this.alerts.raise(
        'instagram.sync_failed',
        `Instagram gönderileri alınamadı: ${e instanceof Error ? e.message : String(e)}. Bağlantının süresi dolduysa INSTAGRAM_ACCESS_TOKEN yenilenmeli.`,
      );
    }
  }

  // ─────────────────────────── publishing (admin) ───────────────────────────

  /** Whether the shop's account is connected, and as whom. */
  async account(): Promise<{ connected: boolean; username?: string }> {
    const token = await this.token();
    if (!token) return { connected: false };
    try {
      const me = await this.call<{ username?: string }>('me', { fields: 'user_id,username', access_token: token });
      return { connected: true, username: me.username };
    } catch (e) {
      this.logger.warn(`Instagram hesabı okunamadı: ${e instanceof Error ? e.message : String(e)}`);
      return { connected: false };
    }
  }

  /**
   * Posts one of our photos with its caption to the shop's own account. Instagram takes JPEG between 4:5 and
   * 1.91:1 from a public address, so a JPEG copy is made in our uploads first (padded with the studio grey if the
   * photo is taller than 4:5).
   */
  async publish(imageUrl: string, caption: string) {
    const token = await this.token();
    if (!token) throw new ServiceUnavailableException('Instagram bağlı değil (INSTAGRAM_ACCESS_TOKEN)');
    const source = await this.readUpload(imageUrl);
    if (!source) throw new BadRequestException('Görsel bu sitenin yüklemelerinden olmalı');
    let img = sharp(source).rotate().resize(1440, 1800, { fit: 'inside', withoutEnlargement: true });
    const { width = 1, height = 1 } = await sharp(await img.toBuffer()).metadata();
    if (width / height < 0.8) {
      const pad = Math.ceil((height * 0.8 - width) / 2);
      img = sharp(await img.toBuffer()).extend({ left: pad, right: pad, background: '#f2f2f2' });
    } else if (width / height > 1.91) {
      const pad = Math.ceil((width / 1.91 - height) / 2);
      img = sharp(await img.toBuffer()).extend({ top: pad, bottom: pad, background: '#f2f2f2' });
    }
    const outDir = join(this.root, 'instagram-posts');
    await mkdir(outDir, { recursive: true });
    const file = `${randomBytes(8).toString('hex')}.jpg`;
    await writeFile(join(outDir, file), await img.flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer());
    const publicUrl = `${this.publicBase}/instagram-posts/${file}`;

    const me = await this.call<{ user_id: string }>('me', { fields: 'user_id', access_token: token });
    const container = await this.post<{ id: string }>(`${me.user_id}/media`, { image_url: publicUrl, caption: caption.slice(0, 2200), access_token: token });
    // The photo is fetched and processed by Instagram before it can be published.
    for (let i = 0; i < 20; i++) {
      const st = await this.call<{ status_code?: string }>(container.id, { fields: 'status_code', access_token: token });
      if (st.status_code === 'FINISHED') break;
      if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new BadRequestException('Instagram fotoğrafı işleyemedi');
      await new Promise((r) => setTimeout(r, 2000));
    }
    const media = await this.post<{ id: string }>(`${me.user_id}/media_publish`, { creation_id: container.id, access_token: token });
    const info = await this.call<{ permalink?: string }>(media.id, { fields: 'permalink', access_token: token }).catch(() => ({ permalink: undefined }));
    void this.sync();
    return { id: media.id, permalink: info.permalink };
  }

  /** The stored, refreshed token (or the one in .env until the first sync). */
  private async token() {
    if (!this.envToken) return '';
    const feed = await this.read();
    return feed.envHash === hash(this.envToken) && feed.token ? feed.token : this.envToken;
  }

  private async readUpload(url: string): Promise<Buffer | null> {
    const basePath = this.publicBase.replace(/^https?:\/\/[^/]+/, '');
    const rel = url.startsWith(`${this.publicBase}/`) ? url.slice(this.publicBase.length + 1) : url.startsWith(`${basePath}/`) ? url.slice(basePath.length + 1) : null;
    if (rel === null) return null;
    const path = resolve(join(this.root, rel));
    if (!path.startsWith(this.root)) return null;
    return readFile(path).catch(() => null);
  }

  /** Graph API POST with a form body (the token stays out of the address). */
  private async post<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body: new URLSearchParams(params), signal: AbortSignal.timeout(60_000) });
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok || body.error) throw new BadRequestException(`Instagram: ${body.error?.message ?? res.status}`);
    return body;
  }

  /** Graph API GET; the token travels as a query parameter (as the API expects) and is never logged. */
  private async call<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(20_000) });
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok || body.error) throw new Error(`${path}: ${res.status} ${body.error?.message ?? ''}`.trim());
    return body;
  }

  private async read(): Promise<Feed> {
    const row = await this.prisma.setting.findUnique({ where: { key: KEY } });
    return { posts: [], ...((row?.value as Feed | null) ?? {}) };
  }

  private async write(feed: Feed) {
    const value = feed as unknown as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  }
}
