/**
 * Maintenance mode, switched in the admin top bar. The proxy asks the API on each page view (cached here a few
 * seconds) and answers with a small self-contained "back soon" page (503) unless the visitor carries the staff
 * preview cookie. If the API can't be reached the shop stays open.
 */
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const TTL = 10_000;

export const PREVIEW_COOKIE = 'mj-preview';

type State = { enabled: boolean; preview: boolean };
const cache = new Map<string, { at: number; state: State }>();

export async function maintenanceState(preview: string | undefined): Promise<State> {
  const key = preview ?? '';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.state;
  let state: State = { enabled: false, preview: false };
  try {
    const res = await fetch(`${API_URL}/settings/maintenance${preview ? `?preview=${encodeURIComponent(preview)}` : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const body = (await res.json()) as { data?: State } & State;
      state = body.data ?? body;
    }
  } catch {
    // API down: keep the shop open rather than closing it by mistake.
  }
  if (cache.size > 50) cache.clear();
  cache.set(key, { at: Date.now(), state });
  return state;
}

const TEXT: Record<string, [string, string]> = {
  en: ['We are making a few improvements.', 'Back very soon.'],
  tr: ['Sitemizde kısa bir bakım yapıyoruz.', 'Çok yakında buradayız.'],
  de: ['Wir nehmen gerade ein paar Verbesserungen vor.', 'Wir sind bald zurück.'],
  fr: ['Nous apportons quelques améliorations.', 'De retour très bientôt.'],
  it: ['Stiamo apportando alcuni miglioramenti.', 'Torniamo prestissimo.'],
  es: ['Estamos haciendo algunas mejoras.', 'Volvemos muy pronto.'],
  nl: ['We voeren enkele verbeteringen door.', 'We zijn snel terug.'],
  ru: ['Мы вносим небольшие улучшения.', 'Скоро вернёмся.'],
  ja: ['ただいまサイトのメンテナンス中です。', 'まもなく再開いたします。'],
  ko: ['사이트를 점검하고 있습니다.', '곧 다시 찾아뵙겠습니다.'],
  zh: ['网站正在维护中。', '我们很快回来。'],
};

export function maintenancePage(locale: string) {
  const [line, soon] = TEXT[locale] ?? TEXT.en;
  return `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>MAEYJA</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;font:300 14px/1.7 Georgia,'Times New Roman',serif;color:#1a1a1a;background:#f5f1ea;text-align:center"><main style="padding:24px"><div style="font:400 26px/1 system-ui,sans-serif;letter-spacing:.42em;padding-left:.42em">MAEYJA</div><p style="margin:28px 0 0">${line}</p><p style="margin:2px 0 0;opacity:.65">${soon}</p></main></body></html>`;
}
