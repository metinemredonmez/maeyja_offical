'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, Fragment, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api.client';
import { modelNo, money } from '@/lib/format';
import type { ProductCard } from '@/lib/types';

type Message = { role: 'user' | 'assistant'; content: string; products?: ProductCard[]; handoff?: { whatsapp: string } | null };

/** The conversation lives only in this tab (sessionStorage) and is sent with each question; the server keeps nothing. */
const KEY = 'mj-assistant';
const load = (): Message[] => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as Message[];
  } catch {
    return [];
  }
};
const save = (messages: Message[]) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(messages.slice(-24)));
  } catch {
    /* private mode: the chat simply isn't kept */
  }
};

/** "/products/origami" in a reply becomes a link in the reader's language. */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(\/(?:products|collections|shipping-returns|care|contact|order-status|expertise|about|faq|stockists|journal)(?:\/[a-z0-9-]+)?)/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <Link key={i} href={part} className="underline underline-offset-2 hover:text-brand">
            {part}
          </Link>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Right-hand chat drawer (full screen on phones) with a quiet "Assistant" button in the corner. */
export function AssistantPanel({ welcome }: { welcome: string }) {
  const t = useTranslations('assistant');
  const nav = useTranslations('nav');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMessages(load()), []);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const next: Message[] = [...messages, { role: 'user', content: text.slice(0, 1000) }];
    setMessages(next);
    save(next);
    setDraft('');
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.post<{ reply: string; products: ProductCard[]; handoff: { whatsapp: string } | null }>(
        '/assistant/chat',
        { locale, messages: next.map(({ role, content }) => ({ role, content })) },
        locale,
      );
      const done: Message[] = [...next, { role: 'assistant', content: res.reply, products: res.products, handoff: res.handoff }];
      setMessages(done);
      save(done);
    } catch (err) {
      setNotice(err instanceof ApiError && err.status === 429 ? t('limit') : t('error'));
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const reset = () => {
    setMessages([]);
    save([]);
    setNotice(null);
  };

  return (
    <>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="label fixed right-4 bottom-4 z-40 bg-ink px-5 py-3 text-ground shadow-[0_10px_30px_rgba(0,0,0,0.18)] hover:bg-brand md:right-6 md:bottom-6">
          {t('open')}
        </button>
      ) : null}

      <div className={`fixed inset-0 z-50 transition-opacity duration-300 md:bg-ink/20 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-ground shadow-[-20px_0_60px_rgba(0,0,0,0.12)] transition-transform duration-500 ease-out md:w-[420px] ${open ? 'translate-x-0' : 'pointer-events-none translate-x-full'}`}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="label">{t('title')}</p>
          <div className="flex items-center gap-4">
            {messages.length ? (
              <button type="button" onClick={reset} className="label text-muted hover:text-ink">
                {t('reset')}
              </button>
            ) : null}
            <button type="button" onClick={() => setOpen(false)} aria-label={nav('close')} className="flex h-9 w-9 items-center justify-center hover:text-brand">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>
        </header>

        <div ref={list} className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6" aria-live="polite">
          <p className="max-w-[85%] font-serif text-[18px] leading-snug">{welcome}</p>
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <p key={i} className="max-w-[85%] self-end bg-stone px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line">
                {m.content}
              </p>
            ) : (
              <div key={i} className="flex max-w-[92%] flex-col gap-3">
                <p className="font-serif text-[17px] leading-relaxed whitespace-pre-line">
                  <Linked text={m.content} />
                </p>
                {m.products?.map((p) => (
                  <Link key={p.slug} href={`/products/${p.slug}`} onClick={() => setOpen(false)} className="group flex items-center gap-3 border border-line bg-ground p-2 hover:border-ink">
                    <span className="relative block aspect-[4/5] w-14 shrink-0 overflow-hidden bg-stone">
                      {p.images[0] ? <Image src={p.images[0].url} alt={p.images[0].alt ?? p.name} fill sizes="56px" className="object-cover" /> : null}
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="label group-hover:text-brand">
                        {modelNo(p.number) ? `${modelNo(p.number)} ` : ''}
                        {p.name}
                      </span>
                      <span className="text-[13px] text-ink-soft">{money(p.price, locale)}</span>
                    </span>
                  </Link>
                ))}
                {/* Urgent cases: a person takes over on WhatsApp, with the visitor's request already written out. */}
                {m.handoff ? (
                  <a href={m.handoff.whatsapp} target="_blank" rel="noopener" className="btn-primary flex items-center justify-center gap-2.5 self-start">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.6-.3Z" />
                    </svg>
                    {t('whatsapp')}
                  </a>
                ) : null}
              </div>
            ),
          )}
          {busy ? (
            <p className="flex gap-1.5 py-2" aria-label="…">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${d * 180}ms` }} />
              ))}
            </p>
          ) : null}
          {notice ? <p className="text-[13px] text-brand">{notice}</p> : null}
        </div>

        <form onSubmit={send} className="border-t border-line px-5 pt-4 pb-5">
          <div className="flex items-end gap-3">
            <label htmlFor="assistant-input" className="sr-only">
              {t('placeholder')}
            </label>
            <textarea
              id="assistant-input"
              ref={input}
              rows={2}
              maxLength={1000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder={t('placeholder')}
              className="flex-1 resize-none border-0 border-b border-line bg-transparent py-2 text-[15px] placeholder:text-muted focus:border-ink focus:outline-none"
            />
            <button type="submit" disabled={busy || !draft.trim()} className="btn-primary px-5">
              {t('send')}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-snug text-muted">{t('note')}</p>
        </form>
      </aside>
    </>
  );
}
