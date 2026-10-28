import sanitizeHtml from 'sanitize-html';

/**
 * Incoming email HTML is hostile input. It is stored sanitised and the admin renders it in a
 * sandboxed iframe (no scripts, no same-origin), so this keeps layout/styling but drops anything
 * executable: scripts, event handlers, forms, iframes/objects and javascript: URLs.
 */
export function sanitizeMailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img', 'style', 'font', 'center', 'span', 'div', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'col', 'colgroup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'small', 'big', 'sup', 'sub', 'u', 's', 'strike', 'del', 'ins', 'hr', 'br',
    ],
    // style tags are only "vulnerable" when scripts can run; the viewer iframe has none.
    allowVulnerableTags: true,
    allowedAttributes: {
      '*': ['style', 'align', 'valign', 'width', 'height', 'bgcolor', 'background', 'border', 'cellpadding', 'cellspacing', 'color', 'face', 'size', 'class', 'dir', 'lang', 'colspan', 'rowspan', 'title'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  });
}

/** Plain-text preview line for the list. */
export function snippetOf(text: string | null | undefined, html: string | null | undefined, max = 180): string {
  const source = text?.trim() || (html ? sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }) : '');
  return source.replace(/\s+/g, ' ').trim().slice(0, max);
}
