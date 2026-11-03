/**
 * Maintenance mode, switched in the admin top bar. The proxy asks the API on each page view (cached here a few
 * seconds) and answers with a small self-contained "back soon" page (503) unless the visitor carries the staff
 * preview cookie. If the API can't be reached the shop stays open.
 */
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const TTL = 10_000;

export const PREVIEW_COOKIE = 'mj-preview';
/** Set by the proxy (never taken from the browser) once the preview cookie is checked against the API. */
export const PREVIEW_HEADER = 'x-mj-preview';

type Contact = { email?: string; phone?: string; instagram?: string };
type State = { enabled: boolean; preview: boolean; contact?: Contact };

/** The shop-wide answer (on/off, contact), shared by every visitor. */
let shared: { at: number; enabled: boolean; contact?: Contact } | null = null;
/** Preview tokens already checked, newest last; a flood of made-up tokens only pushes out other made-up ones. */
const previews = new Map<string, { at: number; ok: boolean }>();
const PREVIEWS_KEPT = 100;

async function ask(preview?: string): Promise<State | null> {
  try {
    const res = await fetch(`${API_URL}/settings/maintenance${preview ? `?preview=${encodeURIComponent(preview)}` : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: State } & State;
    return body.data ?? body;
  } catch {
    return null;
  }
}

/**
 * Whether the shop is closed, and whether this visitor's preview token is the staff one. If the API doesn't answer,
 * the last known state stands (a slow API mustn't open a closed shop); before any answer the shop stays open.
 */
export async function maintenanceState(preview: string | undefined): Promise<State> {
  const now = Date.now();
  if (!shared || now - shared.at > TTL) {
    const s = await ask();
    if (s) shared = { at: now, enabled: s.enabled, contact: s.contact };
    else if (shared) shared.at = now - TTL + 2_000; // keep the old answer, ask again in two seconds
  }
  let ok = false;
  if (preview) {
    const hit = previews.get(preview);
    if (hit && now - hit.at < TTL) ok = hit.ok;
    else {
      const s = await ask(preview);
      ok = s ? s.preview : (hit?.ok ?? false);
      previews.delete(preview);
      previews.set(preview, { at: now, ok });
      if (previews.size > PREVIEWS_KEPT) previews.delete(previews.keys().next().value!);
    }
  }
  return { enabled: shared?.enabled ?? false, preview: ok, contact: shared?.contact };
}

const TEXT: Record<string, [string, string, string]> = {
  en: ['We are making a few improvements.', 'Back very soon.', 'Contact us'],
  tr: ['Sitemizde kısa bir bakım yapıyoruz.', 'Çok yakında buradayız.', 'Bize ulaşın'],
  de: ['Wir nehmen gerade ein paar Verbesserungen vor.', 'Wir sind bald zurück.', 'Kontakt'],
  fr: ['Nous apportons quelques améliorations.', 'De retour très bientôt.', 'Nous contacter'],
  it: ['Stiamo apportando alcuni miglioramenti.', 'Torniamo prestissimo.', 'Contattaci'],
  es: ['Estamos haciendo algunas mejoras.', 'Volvemos muy pronto.', 'Contáctanos'],
  nl: ['We voeren enkele verbeteringen door.', 'We zijn snel terug.', 'Contact'],
  ru: ['Мы вносим небольшие улучшения.', 'Скоро вернёмся.', 'Связаться с нами'],
  ja: ['ただいまサイトのメンテナンス中です。', 'まもなく再開いたします。', 'お問い合わせ'],
  ko: ['사이트를 점검하고 있습니다.', '곧 다시 찾아뵙겠습니다.', '문의'],
  zh: ['网站正在维护中。', '我们很快回来。', '联系我们'],
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** E-mail, phone and Instagram from the store settings, each only when filled in. */
function contactLinks(c: Contact | undefined) {
  const links: string[] = [];
  if (c?.email) links.push(`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`);
  if (c?.phone) links.push(`<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a>`);
  if (c?.instagram && /^https:\/\//.test(c.instagram)) {
    const handle = c.instagram.replace(/\/+$/, '').split('/').pop();
    links.push(`<a href="${esc(c.instagram)}" rel="noopener">Instagram${handle ? ` · @${esc(handle)}` : ''}</a>`);
  }
  return links;
}

/**
 * The campaign photo (model with the Petal Box on the black-sand beach, from public/maintenance) fills the screen;
 * the message sits on a frosted grey panel beside her on wide screens and below her on phones.
 */
export function maintenancePage(locale: string, contact?: Contact) {
  const [line, soon, reach] = TEXT[locale] ?? TEXT.en;
  const links = contactLinks(contact);
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>MAEYJA</title>
<style>
html,body{margin:0;height:100%;background:#2b2c31}
body{position:relative;min-height:100svh;overflow:hidden;font:300 15px/1.7 Georgia,'Times New Roman',serif;color:#1a1a1a}
picture,picture img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:right center}
.veil{position:absolute;inset:0;background:linear-gradient(90deg,rgba(40,40,44,.35),rgba(40,40,44,0) 60%)}
main{position:absolute;left:6vw;top:50%;transform:translateY(-50%);width:min(420px,40vw);padding:48px 40px;text-align:center;background:rgba(242,242,242,.55);-webkit-backdrop-filter:blur(18px) saturate(1.1);backdrop-filter:blur(18px) saturate(1.1);border:1px solid rgba(255,255,255,.45)}
.mark{font:400 28px/1 system-ui,-apple-system,'Helvetica Neue',sans-serif;letter-spacing:.42em;padding-left:.42em}
.rule{width:36px;height:1px;background:#1a1a1a;opacity:.35;margin:26px auto}
p{margin:0}.soon{opacity:.7;margin-top:2px}
.reach{margin-top:26px;font:400 10.5px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;opacity:.6}
.links{margin-top:12px;display:flex;flex-direction:column;gap:6px;font-size:14px}
.links a{color:inherit;text-decoration:none;border-bottom:1px solid rgba(26,26,26,.25);align-self:center;padding-bottom:1px}
.links a:hover{border-color:#1a1a1a}
@media (max-width:767px){main{left:16px;right:16px;top:44%;transform:none;width:auto;padding:26px 20px}.veil{background:rgba(40,40,44,.12)}.mark{font-size:22px}.rule{margin:16px auto}.reach{margin-top:18px}}
</style></head>
<body><picture><source media="(max-width:767px)" srcset="/maintenance/tall.webp"><img src="/maintenance/wide.webp" alt=""></picture><div class="veil"></div>
<main><div class="mark">MAEYJA</div><div class="rule"></div><p>${line}</p><p class="soon">${soon}</p>${links.length ? `<p class="reach">${reach}</p><div class="links">${links.join('')}</div>` : ''}</main></body></html>`;
}
