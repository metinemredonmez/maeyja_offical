'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api.client';

type Step = 'pick' | 'working' | 'done' | 'error';

/**
 * Shrinks the photo in the browser before upload: keeps the request under the site's 2 MB limit and, because
 * the image is redrawn, drops EXIF data such as location.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.86));
}

/** Same-origin calls through the web proxy (multipart for the photo, then polling for the result). */
async function call<T>(path: string, init: RequestInit, locale: string): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: { ...(init.headers ?? {}), 'X-Requested-With': 'mj', 'Accept-Language': locale } });
  const json = (await res.json().catch(() => ({}))) as { data?: T; message?: string };
  if (!res.ok) throw new ApiError(json.message ?? 'error', res.status);
  return json.data as T;
}

/** "Üzerimde gör": consent → photo → Gemini places the selected bag on the visitor → before/after slider. */
export function TryOn({ slug, color, productName }: { slug: string; color: string | null; productName: string }) {
  const t = useTranslations('tryon');
  const nav = useTranslations('nav');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('pick');
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [split, setSplit] = useState(50);
  const polling = useRef(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(polling.current);
    };
  }, [open]);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const blob = await shrink(file);
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ blob, url: URL.createObjectURL(blob) });
    setResult(null);
    setStep('pick');
  };

  const create = async () => {
    if (!photo) return;
    setStep('working');
    setMessage(null);
    try {
      const form = new FormData();
      form.append('photo', photo.blob, 'photo.jpg');
      form.append('slug', slug);
      if (color) form.append('color', color);
      form.append('consent', String(consent));
      form.append('adult', String(adult));
      const { id } = await call<{ id: string }>('/tryon', { method: 'POST', body: form }, locale);
      const started = Date.now();
      const poll = async () => {
        const r = await call<{ status: string; image: string | null }>(`/tryon/${id}`, { method: 'GET' }, locale);
        if (r.status === 'done' && r.image) {
          setResult(r.image);
          setSplit(50);
          setStep('done');
        } else if (r.status === 'failed' || Date.now() - started > 150_000) {
          setMessage(t('error'));
          setStep('error');
        } else polling.current = window.setTimeout(poll, 2500);
      };
      polling.current = window.setTimeout(poll, 4000);
    } catch (err) {
      setMessage(err instanceof ApiError && err.status === 429 ? t('limit') : t('error'));
      setStep('error');
    }
  };

  const ready = Boolean(photo && consent && adult);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="link-underline">
        {t('button')}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center md:p-6" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={t('button')} onClick={(e) => e.stopPropagation()} className="relative flex max-h-[100svh] w-full max-w-xl flex-col gap-6 overflow-y-auto bg-ground px-6 pt-12 pb-8 text-left md:max-h-[92svh] md:px-10">
            <button type="button" onClick={() => setOpen(false)} aria-label={nav('close')} className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center hover:text-brand">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
            <div className="flex flex-col gap-2 text-center">
              <h2 className="display text-[28px]">{t('button')}</h2>
              <p className="label text-muted">{productName}</p>
            </div>

            {step === 'done' && result && photo ? (
              <div className="flex flex-col gap-4">
                {/* Before / after: the result sits on top, clipped from the left by the slider. */}
                <div className="relative w-full overflow-hidden bg-stone select-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={t('before')} className="block w-full" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result} alt={t('after')} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
                  <span className="pointer-events-none absolute inset-y-0 w-px bg-white" style={{ left: `${split}%` }} />
                  <span className="label absolute top-3 left-3 bg-ground/80 px-2 py-1">{t('before')}</span>
                  <span className="label absolute top-3 right-3 bg-ground/80 px-2 py-1">{t('after')}</span>
                </div>
                <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label={`${t('before')} / ${t('after')}`} className="w-full accent-ink" />
                <div className="flex flex-wrap gap-3">
                  <a href={result} download={`maeyja-${slug}.jpg`} className="btn-primary">
                    {t('download')}
                  </a>
                  <label className="btn-outline cursor-pointer">
                    {t('again')}
                    <input type="file" accept="image/*" className="sr-only" onChange={pick} />
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <p className="text-[14px] leading-relaxed text-ink-soft">{t('intro')}</p>
                <label className="relative flex aspect-[4/5] w-full max-w-[260px] cursor-pointer items-center justify-center self-center overflow-hidden border border-dashed border-line bg-stone/60 hover:border-ink">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="label text-muted">{t('choose')}</span>
                  )}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} />
                </label>
                <label className="flex items-start gap-3 text-[13px] leading-snug text-ink-soft">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-ink" />
                  <span>
                    {t('consent')}{' '}
                    <Link href="/kvkk" className="underline underline-offset-2 hover:text-brand">
                      {t('privacy')}
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-[13px] leading-snug text-ink-soft">
                  <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 accent-ink" />
                  <span>{t('adult')}</span>
                </label>
                {step === 'working' ? (
                  <p className="label flex items-center gap-3 text-muted" role="status">
                    <span className="h-3 w-3 animate-spin rounded-full border border-ink border-t-transparent" />
                    {t('working')}
                  </p>
                ) : (
                  <button type="button" onClick={create} disabled={!ready} className="btn-primary self-start">
                    {t('create')}
                  </button>
                )}
                {message ? <p className="text-[13px] text-brand">{message}</p> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
