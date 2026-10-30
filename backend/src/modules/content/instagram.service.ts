import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { access, mkdir, readdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';

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
  private readonly publicBase: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.envToken = config.get('INSTAGRAM_ACCESS_TOKEN', { infer: true });
    this.dir = join(resolve(config.get('UPLOAD_DIR', { infer: true })), 'instagram');
    this.publicBase = config.get('UPLOAD_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
  }

  onModuleInit() {
    void this.sync();
  }

  async posts(): Promise<InstagramPost[]> {
    return (await this.read()).posts;
  }

  @Cron(CronExpression.EVERY_HOUR)
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
    } catch (e) {
      this.logger.warn(`Instagram eşitlenemedi: ${e instanceof Error ? e.message : String(e)}`);
    }
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
