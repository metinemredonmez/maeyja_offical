'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api.client';

type Step = 'pick' | 'working' | 'done' | 'error';
type Mode = 'photo' | 'avatar';

/** The avatar's choices; the API groups them (tryon-avatar.ts), so one avatar serves everyone who picks the same. */
type Avatar = { height: number; body: 'slim' | 'regular' | 'curvy'; skin: 'fair' | 'light' | 'medium' | 'tan' | 'deep'; hair: 'blonde' | 'brown' | 'black' | 'red'; length: 'short' | 'long' };
const BODIES = ['slim', 'regular', 'curvy'] as const;
const SKINS = { fair: '#F3DCC8', light: '#E6BC98', medium: '#C69072', tan: '#9C6B4A', deep: '#5E3A26' } as const;
const HAIRS = { blonde: '#D8B46A', brown: '#6B4630', black: '#1F1A17', red: '#9A3F23' } as const;
const LENGTHS = ['short', 'long'] as const;
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

/** Same-origin calls through the web proxy (multipart for the photo, JSON for an avatar, then polling for the result). */
async function call<T>(path: string, init: RequestInit, locale: string): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: { ...(init.headers ?? {}), 'X-Requested-With': 'mj', 'Accept-Language': locale } });
  const json = (await res.json().catch(() => ({}))) as { data?: T; message?: string };
  if (!res.ok) throw new ApiError(json.message ?? 'error', res.status);
  return json.data as T;
}

/** A round colour choice with its name for screen readers. */
function Swatch({ colour, name, selected, onClick }: { colour: string; name: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      aria-pressed={selected}
      title={name}
      className={`h-8 w-8 rounded-full border transition ${selected ? 'border-ink ring-1 ring-ink ring-offset-2 ring-offset-ground' : 'border-line hover:border-ink'}`}
      style={{ backgroundColor: colour }}
    />
  );
}

function Chip({ children, selected, onClick }: { children: React.ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`border px-4 py-2 text-[13px] transition ${selected ? 'border-ink bg-ink text-ground' : 'border-line hover:border-ink'}`}>
      {children}
    </button>
  );
}

/**
 * "Üzerimde gör", two ways: the visitor's own photo (consent → photo → Gemini places the selected bag → before/after
 * slider), or an avatar of their choices (height, build, skin, hair) carrying the bag — no photo, so no consent.
 */
export function TryOn({ slug, color, productName }: { slug: string; color: string | null; productName: string }) {
  const t = useTranslations('tryon');
  const nav = useTranslations('nav');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('photo');
  const [step, setStep] = useState<Step>('pick');
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [avatar, setAvatar] = useState<Avatar>({ height: 166, body: 'regular', skin: 'medium', hair: 'brown', length: 'long' });
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

  const switchMode = (next: Mode) => {
    clearTimeout(polling.current);
    setMode(next);
    setResult(null);
    setMessage(null);
    setStep('pick');
  };

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

  const fail = (err: unknown) => {
    setMessage(err instanceof ApiError && err.status === 429 ? t('limit') : t('error'));
    setStep('error');
  };

  /** Polls until the picture is ready; a new avatar takes two pictures, so it gets longer. */
  const follow = (id: string, maxMs: number) => {
    const started = Date.now();
    const poll = async () => {
      try {
        const r = await call<{ status: string; image: string | null }>(`/tryon/${id}`, { method: 'GET' }, locale);
        if (r.status === 'done' && r.image) {
          setResult(r.image);
          setSplit(50);
          setStep('done');
        } else if (r.status === 'failed' || Date.now() - started > maxMs) {
          setMessage(t('error'));
          setStep('error');
        } else polling.current = window.setTimeout(poll, 2500);
      } catch (err) {
        fail(err);
      }
    };
    polling.current = window.setTimeout(poll, 4000);
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
      follow(id, 150_000);
    } catch (err) {
      fail(err);
    }
  };

  const createAvatar = async () => {
    setStep('working');
    setMessage(null);
    try {
      const r = await call<{ id: string | null; status: string; image: string | null }>(
        '/tryon/avatar',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, ...(color ? { color } : {}), ...avatar }) },
        locale,
      );
      if (r.image) {
        setResult(r.image);
        setStep('done');
      } else if (r.id) follow(r.id, 240_000);
    } catch (err) {
      fail(err);
    }
  };

  const ready = Boolean(photo && consent && adult);
  const set = (patch: Partial<Avatar>) => setAvatar((a) => ({ ...a, ...patch }));
  const working = (
    <p className="label flex items-center gap-3 text-muted" role="status">
      <span className="h-3 w-3 animate-spin rounded-full border border-ink border-t-transparent" />
      {mode === 'avatar' ? t('workingAvatar') : t('working')}
    </p>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline w-full">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M3 8h3.5L8 5.5h8L17.5 8H21v11H3z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
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

            <div role="tablist" className="grid grid-cols-2 border-b border-line">
              {(['photo', 'avatar'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  disabled={step === 'working'}
                  onClick={() => switchMode(m)}
                  className={`label -mb-px border-b py-3 transition ${mode === m ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {m === 'photo' ? t('tabPhoto') : t('tabAvatar')}
                </button>
              ))}
            </div>

            {mode === 'avatar' ? (
              step === 'done' && result ? (
                <div className="flex flex-col gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result} alt={productName} className="block w-full bg-stone" />
                  <p className="text-[12px] text-muted">{t('avatarNote')}</p>
                  <div className="flex flex-wrap gap-3">
                    <a href={result} download={`maeyja-${slug}.jpg`} target="_blank" rel="noopener" className="btn-primary">
                      {t('download')}
                    </a>
                    <button type="button" onClick={() => setStep('pick')} className="btn-outline">
                      {t('change')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <p className="text-[14px] leading-relaxed text-ink-soft">{t('avatarIntro')}</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between">
                      <span className="label">{t('height')}</span>
                      <span className="font-serif text-[18px]">{avatar.height} cm</span>
                    </div>
                    <input type="range" min={145} max={195} value={avatar.height} onChange={(e) => set({ height: Number(e.target.value) })} aria-label={t('height')} className="w-full accent-ink" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="label">{t('body')}</span>
                    <div className="flex flex-wrap gap-2">
                      {BODIES.map((b) => (
                        <Chip key={b} selected={avatar.body === b} onClick={() => set({ body: b })}>
                          {t(`body${label(b)}`)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="label">{t('skin')}</span>
                    <div className="flex flex-wrap gap-3">
                      {(Object.keys(SKINS) as Avatar['skin'][]).map((s) => (
                        <Swatch key={s} colour={SKINS[s]} name={t(`skin${label(s)}`)} selected={avatar.skin === s} onClick={() => set({ skin: s })} />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="label">{t('hair')}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      {(Object.keys(HAIRS) as Avatar['hair'][]).map((h) => (
                        <Swatch key={h} colour={HAIRS[h]} name={t(`hair${label(h)}`)} selected={avatar.hair === h} onClick={() => set({ hair: h })} />
                      ))}
                      <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
                      {LENGTHS.map((l) => (
                        <Chip key={l} selected={avatar.length === l} onClick={() => set({ length: l })}>
                          {t(`hair${label(l)}`)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <p className="text-[12px] text-muted">{t('avatarNote')}</p>
                  {step === 'working' ? (
                    working
                  ) : (
                    <button type="button" onClick={createAvatar} className="btn-primary self-start">
                      {t('create')}
                    </button>
                  )}
                  {message ? <p className="text-[13px] text-brand">{message}</p> : null}
                </div>
              )
            ) : step === 'done' && result && photo ? (
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
                  working
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
