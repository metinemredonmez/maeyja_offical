import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { decrypt, encrypt, keyFromEnv } from '../../common/utils/crypto.util';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

/** EXT-01: the only host this module calls. */
const GRAPH = 'https://graph.facebook.com/v23.0';
const ROW = 'metaAdsKeys';

/** A system-user access token (letters and digits) and an ad account id, with or without "act_". */
export const META_TOKEN = /^[A-Za-z0-9_-]{40,600}$/;
export const AD_ACCOUNT = /^(?:act_)?(\d{5,25})$/;

type Stored = { tokenEnc: string; accountId: string; accountName: string; currency: string; tokenHint: string; savedAt: string };
type GraphError = { error?: { message?: string; code?: number } };

const hintOf = (token: string) => `${token.slice(0, 4)}…${token.slice(-4)}`;

/**
 * The shop's own Meta ad account (KEY-01): a system-user token pasted in the admin, kept encrypted
 * (APP_ENCRYPTION_KEY) and never shown or logged again. Read-only for now — campaigns, spend and results.
 */
@Injectable()
export class MetaAdsClient {
  private readonly encKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    config: ConfigService<Env, true>,
  ) {
    this.encKey = keyFromEnv(config.get('APP_ENCRYPTION_KEY', { infer: true }), config.get('JWT_ACCESS_SECRET', { infer: true }));
  }

  async status() {
    const s = await this.stored();
    return s
      ? { connected: true as const, accountId: s.accountId, accountName: s.accountName, currency: s.currency, tokenHint: s.tokenHint, savedAt: s.savedAt }
      : { connected: false as const };
  }

  /** Checks the token and the account with Meta before anything is saved. */
  async connect(token: string, adAccount: string) {
    const t = token.trim();
    const m = AD_ACCOUNT.exec(adAccount.trim());
    if (!META_TOKEN.test(t)) throw new BadRequestException('Erişim tokenı geçersiz görünüyor; Meta Business ayarlarındaki sistem kullanıcısı tokenını yapıştırın');
    if (!m) throw new BadRequestException('Reklam hesabı kimliği yalnız rakamlardan oluşmalı (act_ ile ya da onsuz)');
    const accountId = `act_${m[1]}`;
    const account = await this.graph<{ name?: string; currency?: string }>(`/${accountId}`, { fields: 'name,currency,account_status' }, t);
    const stored: Stored = {
      tokenEnc: encrypt(t, this.encKey),
      accountId,
      accountName: account.name ?? accountId,
      currency: account.currency ?? '',
      tokenHint: hintOf(t),
      savedAt: new Date().toISOString(),
    };
    const value = stored as unknown as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key: ROW }, create: { key: ROW, value }, update: { value } });
    void this.alerts.clear('ads.connection');
    return this.status();
  }

  async disconnect() {
    await this.prisma.setting.deleteMany({ where: { key: ROW } });
    return { connected: false as const };
  }

  /** A read with the stored token; a token Meta no longer accepts raises an alert. */
  async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const s = await this.stored();
    if (!s) throw new ServiceUnavailableException('Meta reklam hesabı bağlı değil');
    try {
      return await this.graph<T>(path, params, decrypt(s.tokenEnc, this.encKey));
    } catch (e) {
      if (e instanceof BadRequestException && /token|oturum|yetki/i.test(e.message)) {
        void this.alerts.raise('ads.connection', `Meta reklam hesabı okunamadı: ${e.message}. Reklamlar sayfasından tokenı yeniden girin.`);
      }
      throw e;
    }
  }

  /** EXT-01/02: one fixed host, no redirects, a short timeout; the token never reaches a log or an error message. */
  private async graph<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
    const url = new URL(`${GRAPH}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('access_token', token);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new ServiceUnavailableException("Meta'ya ulaşılamadı, biraz sonra tekrar deneyin");
    }
    const body = (await res.json().catch(() => ({}))) as T & GraphError;
    if (!res.ok || body.error) {
      const code = body.error?.code;
      const message = (body.error?.message ?? `HTTP ${res.status}`).replaceAll(token, '***').slice(0, 200);
      if (code === 190) throw new BadRequestException(`Meta tokenı geçersiz ya da süresi dolmuş (${message})`);
      if (code === 200 || code === 10 || code === 100) throw new BadRequestException(`Bu token bu reklam hesabına yetkili değil ya da hesap bulunamadı (${message})`);
      throw new BadRequestException(`Meta isteği reddetti: ${message}`);
    }
    return body;
  }

  private async stored(): Promise<Stored | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: ROW } });
    return (row?.value as Stored | null) ?? null;
  }
}
