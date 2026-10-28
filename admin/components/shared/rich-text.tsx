'use client';

import { useMemo, useState } from 'react';
import { BoldIcon, EyeIcon, Heading2Icon, ImageIcon, ItalicIcon, LinkIcon, ListIcon, PilcrowIcon, QuoteIcon, WandSparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MediaPicker } from '@/components/shared/media-picker';
import { markdownToHtml, sanitize } from '@/lib/html';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (html: string) => void;
  id?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Simple HTML editor: a textarea holding the stored HTML, a toolbar that wraps the
 * selection in tags, a one-way "Markdown → HTML" helper and a sanitized preview.
 */
export function RichText({ value, onChange, id, rows = 12, placeholder, className, disabled }: Props) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [pickerOpen, setPickerOpen] = useState(false);
  // Element kept in state (callback ref) so toolbar actions never read a ref during render.
  const [el, setEl] = useState<HTMLTextAreaElement | null>(null);
  const preview = useMemo(() => (mode === 'preview' ? sanitize(value || '') : ''), [mode, value]);

  const wrap = (before: string, after = '', block = false) => {
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || (block ? 'Metin' : '');
    const insert = `${before}${selected}${after}`;
    const prefix = block && start > 0 && value[start - 1] !== '\n' ? '\n' : '';
    const next = value.slice(0, start) + prefix + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + prefix.length + before.length;
      el.setSelectionRange(pos, pos + selected.length);
    });
  };

  const tools: { icon: React.ReactNode; label: string; action: () => void }[] = [
    { icon: <PilcrowIcon />, label: 'Paragraf', action: () => wrap('<p>', '</p>', true) },
    { icon: <Heading2Icon />, label: 'Başlık', action: () => wrap('<h2>', '</h2>', true) },
    { icon: <BoldIcon />, label: 'Kalın', action: () => wrap('<strong>', '</strong>') },
    { icon: <ItalicIcon />, label: 'İtalik', action: () => wrap('<em>', '</em>') },
    { icon: <ListIcon />, label: 'Liste', action: () => wrap('<ul>\n  <li>', '</li>\n</ul>', true) },
    { icon: <QuoteIcon />, label: 'Alıntı', action: () => wrap('<blockquote><p>', '</p></blockquote>', true) },
    {
      icon: <LinkIcon />,
      label: 'Bağlantı',
      action: () => {
        const href = window.prompt('Bağlantı adresi (https://…)');
        if (href) wrap(`<a href="${href.replace(/"/g, '&quot;')}">`, '</a>');
      },
    },
    { icon: <ImageIcon />, label: 'Görsel (medya)', action: () => setPickerOpen(true) },
  ];

  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1 py-1">
        {tools.map((t) => (
          <Tooltip key={t.label}>
            <TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" onClick={t.action} disabled={disabled || mode === 'preview'} aria-label={t.label} />}>{t.icon}</TooltipTrigger>
            <TooltipContent>{t.label}</TooltipContent>
          </Tooltip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || mode === 'preview'}
                onClick={() => {
                  if (window.confirm('Metin Markdown olarak yorumlanıp HTML’e dönüştürülecek. Devam?')) onChange(markdownToHtml(value));
                }}
              />
            }
          >
            <WandSparklesIcon /> Markdown → HTML
          </TooltipTrigger>
          <TooltipContent>Markdown yazdıysanız HTML&apos;e çevirir (tek yönlü)</TooltipContent>
        </Tooltip>
        <div className="ml-auto">
          <Button type="button" variant={mode === 'preview' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')} aria-pressed={mode === 'preview'}>
            <EyeIcon /> Önizleme
          </Button>
        </div>
      </div>
      {mode === 'edit' ? (
        <Textarea
          ref={setEl}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder ?? '<p>İçerik…</p>'}
          disabled={disabled}
          className="min-h-40 rounded-none border-0 font-mono text-xs leading-relaxed focus-visible:ring-0"
          spellCheck={false}
        />
      ) : (
        <div className="prose prose-sm prose-neutral max-w-none px-4 py-3 text-sm" dangerouslySetInnerHTML={{ __html: preview || '<p class="text-muted-foreground">İçerik boş</p>' }} />
      )}
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(m) => {
          wrap(`<figure><img src="${m.url}" alt="${(m.alt ?? '').replace(/"/g, '&quot;')}" loading="lazy" />`, '</figure>', true);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
