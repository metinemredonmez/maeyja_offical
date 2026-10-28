import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';

export interface PushMessage {
  title: string;
  body: string;
  url?: string | null;
  imageUrl?: string | null;
  data?: Record<string, unknown>;
}

export interface PushResult {
  ok: boolean;
  id?: string;
  recipients?: number;
  error?: string;
}

/**
 * OneSignal REST API. The mobile app calls `OneSignal.login(user.id)`, so users are
 * addressed by external_id. Android delivery goes through FCM (Firebase) and iOS through
 * APNs — both are configured once in the OneSignal dashboard, not here.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly endpoint = 'https://api.onesignal.com/notifications?c=push';

  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled() {
    return Boolean(this.config.get('ONESIGNAL_APP_ID', { infer: true }) && this.config.get('ONESIGNAL_API_KEY', { infer: true }));
  }

  sendToAll(msg: PushMessage) {
    return this.send({ included_segments: ['Total Subscriptions'] }, msg);
  }

  sendToUsers(userIds: string[], msg: PushMessage) {
    if (!userIds.length) return Promise.resolve<PushResult>({ ok: false, error: 'no recipients' });
    return this.send({ include_aliases: { external_id: userIds }, target_channel: 'push' }, msg);
  }

  private async send(target: Record<string, unknown>, msg: PushMessage): Promise<PushResult> {
    if (!this.enabled) {
      this.logger.log(`[push:dry-run] "${msg.title}"`);
      return { ok: false, error: 'OneSignal not configured (ONESIGNAL_APP_ID / ONESIGNAL_API_KEY)' };
    }
    const body = {
      app_id: this.config.get('ONESIGNAL_APP_ID', { infer: true }),
      ...target,
      // OneSignal requires an `en` entry; Turkish devices pick `tr`.
      headings: { en: msg.title, tr: msg.title },
      contents: { en: msg.body, tr: msg.body },
      ...(msg.url ? { url: msg.url } : {}),
      ...(msg.imageUrl ? { big_picture: msg.imageUrl, ios_attachments: { image: msg.imageUrl } } : {}),
      ...(msg.data ? { data: msg.data } : {}),
    };
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${this.config.get('ONESIGNAL_API_KEY', { infer: true })}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; recipients?: number; errors?: unknown };
      if (!res.ok || !json.id) {
        const error = JSON.stringify(json.errors ?? json).slice(0, 500);
        this.logger.warn(`OneSignal error ${res.status}: ${error}`);
        return { ok: false, error };
      }
      return { ok: true, id: json.id, recipients: json.recipients };
    } catch (e) {
      this.logger.error(`OneSignal request failed: ${(e as Error).message}`);
      return { ok: false, error: (e as Error).message };
    }
  }
}
