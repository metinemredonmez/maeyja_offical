import sanitizeHtml from 'sanitize-html';

/**
 * Allowlist for CMS HTML written by staff (pages, journal, home sections). Applied on write so
 * the stored value is already safe; the storefront sanitises again on render (defence in depth).
 */
export function cleanCmsHtml(html: string | null | undefined): string | null | undefined {
  if (html === null || html === undefined) return html;
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'img', 'figure', 'figcaption', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'], h2: ['id'], h3: ['id'] },
    allowedSchemes: ['https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
  });
}

/** Apply `cleanCmsHtml` to the named keys of a DTO without touching anything else. */
export function cleanHtmlFields<T extends Record<string, unknown>>(dto: T, keys: (keyof T)[]): T {
  const out = { ...dto };
  for (const k of keys) {
    if (typeof out[k] === 'string') out[k] = cleanCmsHtml(out[k] as string) as T[keyof T];
  }
  const translations = out.translations as Record<string, Record<string, unknown>> | undefined;
  if (translations && typeof translations === 'object') {
    for (const lang of Object.keys(translations)) {
      for (const k of keys) {
        const v = translations[lang]?.[k as string];
        if (typeof v === 'string') translations[lang][k as string] = cleanCmsHtml(v);
      }
    }
  }
  return out;
}
