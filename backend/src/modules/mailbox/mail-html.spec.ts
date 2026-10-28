import { sanitizeMailHtml, snippetOf } from './mail-html';

describe('sanitizeMailHtml', () => {
  it('drops scripts, handlers, forms and javascript: links but keeps layout', () => {
    const out = sanitizeMailHtml(
      '<table style="width:100%"><tr><td bgcolor="#eee"><p onclick="steal()">Merhaba</p><script>alert(1)</script>' +
        '<a href="javascript:alert(1)">x</a><a href="https://maeyja.com">site</a><form action="https://evil"><input name="p"></form>' +
        '<iframe src="https://evil"></iframe><img src="data:image/png;base64,AAAA" onerror="x()"></td></tr></table>',
    );
    expect(out).toContain('<table style="width:100%">');
    expect(out).toContain('bgcolor="#eee"');
    expect(out).toContain('Merhaba');
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|<form|<input|<iframe/i);
    expect(out).toContain('href="https://maeyja.com" target="_blank" rel="noopener noreferrer"');
    expect(out).toContain('src="data:image/png;base64,AAAA"');
  });

  it('keeps <style> (the viewer iframe runs no scripts)', () => {
    expect(sanitizeMailHtml('<style>p{color:red}</style><p>x</p>')).toContain('<style>p{color:red}</style>');
  });
});

describe('snippetOf', () => {
  it('prefers text, falls back to html without tags', () => {
    expect(snippetOf('  Merhaba\n\n dünya ', null)).toBe('Merhaba dünya');
    expect(snippetOf(null, '<p>Merhaba <b>dünya</b></p>')).toBe('Merhaba dünya');
    expect(snippetOf('x'.repeat(500), null)).toHaveLength(180);
  });
});
