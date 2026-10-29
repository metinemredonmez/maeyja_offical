import sanitizeHtml from 'sanitize-html';

/** CMS HTML (pages, journal) is authored by staff but still passes through an allowlist. */
export function cleanHtml(html: string, locale?: string) {
  // Links written as "/care" open in the reader's language ("/tr/care"); English has no prefix.
  const prefix = locale && locale !== 'en' ? `/${locale}` : '';
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'img', 'figure', 'figcaption', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { a: ['href', 'title', 'rel', 'target'], img: ['src', 'alt', 'width', 'height', 'loading'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    transformTags: {
      a: (tag, attribs) => ({
        tagName: tag,
        attribs: {
          ...attribs,
          ...(prefix && /^\/(?!\/)/.test(attribs.href ?? '') ? { href: `${prefix}${attribs.href}` } : {}),
          rel: 'noopener',
          ...(attribs.href?.startsWith('http') ? { target: '_blank' } : {}),
        },
      }),
      img: (tag, attribs) => ({ tagName: tag, attribs: { ...attribs, loading: 'lazy' } }),
    },
  });
}
