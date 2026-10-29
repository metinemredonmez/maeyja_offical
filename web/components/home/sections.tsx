import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { Link } from '@/i18n/navigation';
import { cleanHtml } from '@/lib/sanitize';
import { modelNo, money } from '@/lib/format';
import type { HomeSection, ProductCard as Card } from '@/lib/types';
import { ProductCard } from '@/components/product/product-card';
import { NewsletterForm } from '@/components/newsletter-form';
import { Swatch } from '@/components/product/swatch';
import { AutoVideo } from './auto-video';

/** Renders the admin-managed homepage sections in order. Unknown types are skipped. */
export function HomeSections({ sections }: { sections: HomeSection[] }) {
  // The hero's floating card falls back to the first product of the first product block.
  const firstProduct = sections.find((s) => s.type === 'FEATURED_PRODUCTS' && s.products?.length)?.products?.[0];
  return (
    <>
      {sections.map((s, i) => {
        switch (s.type) {
          case 'HERO':
            return <Hero key={s.id} s={s} first={i === 0} product={s.products?.[0] ?? firstProduct} />;
          case 'FEATURED_PRODUCTS':
          case 'COLLECTION':
            return s.layout === 'strip' ? <ModelStrip key={s.id} s={s} /> : <Featured key={s.id} s={s} />;
          case 'CRAFT_STORY':
            return s.layout === 'split' ? <Split key={s.id} s={s} tinted /> : <FullBleed key={s.id} s={s} />;
          case 'EDITORIAL':
            if (s.layout === 'diptych') return <Diptych key={s.id} s={s} />;
            if (s.layout === 'sideways') return <Sideways key={s.id} s={s} />;
            return s.layout === 'full' ? <FullBleed key={s.id} s={s} /> : <Split key={s.id} s={s} />;
          case 'PRESS':
            return <Press key={s.id} s={s} />;
          case 'STOCKISTS':
            return <Stockists key={s.id} s={s} />;
          case 'NEWSLETTER':
            return <Newsletter key={s.id} s={s} />;
          default:
            return null;
        }
      })}
    </>
  );
}

const drift = (value: string) => ({ '--drift': value }) as CSSProperties;

const Cta = ({ s, className = 'link-underline self-start' }: { s: HomeSection; className?: string }) =>
  s.ctaUrl && s.ctaLabel ? (
    <Link href={s.ctaUrl} className={className}>
      {s.ctaLabel}
    </Link>
  ) : null;

/** Section copy may be plain text or rich text from the admin editor. */
function Body({ html, className }: { html: string | null; className?: string }) {
  if (!html) return null;
  return /<[a-z][\s\S]*>/i.test(html) ? <div className={className} dangerouslySetInnerHTML={{ __html: cleanHtml(html) }} /> : <p className={className}>{html}</p>;
}

/** Photo or silent looping video filling its (relative) parent. */
function Media({ s, sizes, priority = false, mobile = true }: { s: HomeSection; sizes: string; priority?: boolean; mobile?: boolean }) {
  if (s.videoUrl) {
    // Phones get the portrait still (and no video download) when one is set; wider screens get the film.
    if (!mobile || !s.mobileImageUrl) return <AutoVideo src={s.videoUrl} poster={s.imageUrl} className="absolute inset-0 h-full w-full object-cover" />;
    return (
      <>
        <AutoVideo src={s.videoUrl} poster={s.imageUrl} className="absolute inset-0 hidden h-full w-full object-cover md:block" />
        <Image src={s.mobileImageUrl} alt="" fill priority={priority} sizes="100vw" className="object-cover md:hidden" />
      </>
    );
  }
  if (!s.imageUrl) return null;
  if (!mobile || !s.mobileImageUrl) return <Image src={s.imageUrl} alt="" fill priority={priority} sizes={sizes} className="object-cover" />;
  return (
    <>
      <Image src={s.imageUrl} alt="" fill priority={priority} sizes={sizes} className="hidden object-cover md:block" />
      <Image src={s.mobileImageUrl} alt="" fill priority={priority} sizes={sizes} className="object-cover md:hidden" />
    </>
  );
}

/**
 * Full-screen hero under the transparent header (Polène + Wandler): the photo drifts slower than
 * the page, the giant wordmark (in the header) shrinks over it, a small product card floats in the corner.
 */
function Hero({ s, first, product }: { s: HomeSection; first: boolean; product?: Card }) {
  const media = Boolean(s.videoUrl || s.imageUrl);
  return (
    <section className={`relative flex h-[100svh] min-h-[560px] items-end overflow-hidden bg-stone ${media ? 'text-white' : ''}`}>
      <div className="hero-drift absolute inset-0">
        <div className="intro-zoom absolute inset-0">
          <Media s={s} sizes="100vw" priority={first} />
        </div>
      </div>
      {/* Top shade keeps the white menu legible; bottom shade carries the headline. */}
      {media ? <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent via-35% to-black/55" aria-hidden="true" /> : null}
      <div className="hero-fade relative flex w-full flex-col gap-8 px-5 pb-10 md:flex-row md:items-end md:justify-between md:px-12 md:pb-14">
        <div className="intro-rise flex max-w-3xl flex-col gap-5">
          {s.title ? <h1 className="display text-[36px] md:text-[60px]">{s.title}</h1> : null}
          {s.subtitle ? <p className={`label ${media ? 'text-white/85' : 'text-ink-soft'}`}>{s.subtitle}</p> : null}
          <Cta s={s} className="link-underline mt-2 self-start" />
        </div>
        {product ? <FloatingCard p={product} /> : null}
      </div>
    </section>
  );
}

function FloatingCard({ p }: { p: Card }) {
  const locale = useLocale();
  const img = p.images[0];
  return (
    <Link href={`/products/${p.slug}`} className="group hidden w-[300px] shrink-0 items-center gap-4 bg-ground p-3 text-ink shadow-[0_12px_40px_rgba(0,0,0,0.12)] md:flex">
      <span className="relative aspect-[4/5] w-[72px] shrink-0 overflow-hidden bg-stone">
        {img ? <Image src={img.url} alt={img.alt ?? p.name} fill sizes="72px" className="object-cover" /> : null}
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="label group-hover:text-brand">
          {modelNo(p.number) ? `${modelNo(p.number)} ` : ''}
          {p.name}
        </span>
        <span className="text-sm text-ink-soft">{money(p.price, locale)}</span>
      </span>
    </Link>
  );
}

function SectionTitle({ title, className = '' }: { title: string | null; className?: string }) {
  return title ? <h2 className={`display text-center text-[40px] md:text-[64px] ${className}`}>{title}</h2> : null;
}

/** Product strip, four across. */
function Featured({ s }: { s: HomeSection }) {
  const t = useTranslations('common');
  if (!s.products?.length) return null;
  const collectionSlug = (s.payload as { collectionSlug?: string } | null)?.collectionSlug;
  return (
    <section className="px-4 pt-24 md:px-12 md:pt-36">
      <div className="reveal mb-12 flex flex-col items-center gap-4 md:mb-16">
        {s.subtitle ? <p className="label text-muted">{s.subtitle}</p> : null}
        <SectionTitle title={s.title} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-6">
        {s.products.slice(0, 8).map((p, i) => (
          <div key={p.id} className="reveal">
            <ProductCard product={p} priority={i < 2} />
          </div>
        ))}
      </div>
      <div className="mt-14 flex justify-center">
        <Link href={collectionSlug ? `/collections/${collectionSlug}` : '/products'} className="link-underline">
          {t('viewAll')}
        </Link>
      </div>
    </section>
  );
}

/**
 * Every model in a row (Liffner's category strip): studio shots on white melt into the cream
 * ground (multiply), so the bags read as cut-outs. Scrolls sideways on small screens.
 */
function ModelStrip({ s }: { s: HomeSection }) {
  if (!s.products?.length) return null;
  return (
    <section className="pt-24 md:pt-36">
      <div className="reveal mb-10 px-4 md:mb-14 md:px-12">
        <SectionTitle title={s.title} />
      </div>
      <ul className="flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] md:scroll-px-12 md:gap-4 md:px-12">
        {s.products.map((p) => (
          <li key={p.id} className="reveal w-[42vw] shrink-0 snap-start md:w-[calc((100%-5*1rem)/6)] md:min-w-[180px]">
            <Link href={`/products/${p.slug}`} className="group flex flex-col items-center gap-3 text-center">
              <span className="relative block aspect-[4/5] w-full bg-ground">
                {p.images[0] ? <Image src={p.images[0].url} alt={p.images[0].alt ?? p.name} fill sizes="(min-width: 768px) 16vw, 42vw" className="object-contain mix-blend-multiply transition duration-700 group-hover:-translate-y-1.5" /> : null}
              </span>
              <span className="label">
                {modelNo(p.number) ? <span className="block text-muted">{modelNo(p.number)}</span> : null}
                <span className="group-hover:text-brand">{p.name}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Cta s={s} className="link-underline mx-auto mt-10 block w-fit" />
    </section>
  );
}

/**
 * Two still-lifes laid out like an editorial spread (Manu Atelier / Liffner): a large picture on the left, the
 * copy and a smaller picture on the right, each drifting at its own speed. Products picked in the admin turn
 * the pictures into links captioned with the model's name and price.
 */
function Diptych({ s }: { s: HomeSection }) {
  const second = s.secondImageUrl ?? s.mobileImageUrl;
  const [left, right] = s.products ?? [];
  return (
    <section className="px-4 pt-24 md:px-12 md:pt-40">
      <div className="grid gap-y-14 md:grid-cols-12 md:gap-x-6">
        <Still url={s.imageUrl} product={left} shift="5%" sizes="(min-width: 768px) 58vw, 100vw" className="md:col-span-7" />
        <div className="flex flex-col gap-14 md:col-span-4 md:col-start-9 md:gap-24">
          <div className="reveal flex flex-col gap-5 md:pt-28">
            {s.subtitle ? <p className="label text-muted">{s.subtitle}</p> : null}
            {s.title ? <h2 className="display text-[36px] leading-[1.05] md:text-[52px]">{s.title}</h2> : null}
            <Body html={s.body} className="text-[15px] leading-relaxed text-ink-soft" />
            <Cta s={s} />
          </div>
          <Still url={second} product={right} shift="12%" sizes="(min-width: 768px) 33vw, 80vw" className="ml-auto w-[82%] md:ml-0 md:w-full" />
        </div>
      </div>
    </section>
  );
}

function Still({ url, product, shift, sizes, className }: { url: string | null; product?: Card; shift: string; sizes: string; className: string }) {
  const locale = useLocale();
  const picture = (
    <span className="relative block aspect-[4/5] overflow-hidden bg-stone">
      <span className="parallax absolute inset-0 block" style={drift(shift)}>
        {url ? <Image src={url} alt={product?.name ?? ''} fill sizes={sizes} className="object-cover transition duration-[1.6s] ease-out group-hover:scale-[1.04]" /> : null}
      </span>
    </span>
  );
  if (!product) return <div className={`reveal ${className}`}>{picture}</div>;
  return (
    <Link href={`/products/${product.slug}`} className={`group reveal block ${className}`}>
      {picture}
      <span className="mt-4 flex items-baseline justify-between gap-4">
        <span className="font-serif text-[22px] font-light leading-none group-hover:text-brand">{product.name}</span>
        <span className="label text-muted">
          {modelNo(product.number) ? `${modelNo(product.number)} · ` : ''}
          {money(product.price, locale)}
        </span>
      </span>
    </Link>
  );
}

/**
 * Edge-to-edge photo or video (Polène's film, Mlouye's banners). With a product picked in the admin a tall
 * product card floats in the lower left (Polène) and the title moves to the top left.
 */
function FullBleed({ s }: { s: HomeSection }) {
  const media = Boolean(s.videoUrl || s.imageUrl);
  const product = s.products?.[0];
  return (
    <section className={`relative mt-24 flex min-h-[85svh] items-end overflow-hidden bg-stone md:mt-36 ${media ? 'text-white' : ''}`}>
      <div className="parallax absolute inset-0" style={drift('9%')}>
        <Media s={s} sizes="100vw" />
      </div>
      {/* With a product card the copy moves to the top left (the card holds the lower left), so the shade follows it. */}
      {media ? (
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 via-45% to-transparent ${product ? 'md:bg-gradient-to-b md:from-black/40 md:via-transparent md:via-40% md:to-black/20' : ''}`}
          aria-hidden="true"
        />
      ) : null}
      {product ? <ProductPanel p={product} /> : null}
      <div className={`reveal relative flex max-w-2xl flex-col gap-5 px-5 pb-10 md:px-12 md:pb-14 ${product ? 'md:absolute md:top-24 md:left-0 md:pb-0' : ''}`}>
        {s.subtitle ? <p className="label opacity-85">{s.subtitle}</p> : null}
        {s.title ? <h2 className="display text-[40px] md:text-[72px]">{s.title}</h2> : null}
        <Body html={s.body} className="max-w-md text-[15px] leading-relaxed opacity-90" />
        <Cta s={s} />
      </div>
    </section>
  );
}

/** Polène's tall product card over a film: name and price on top, the bag below on the cream ground. */
function ProductPanel({ p }: { p: Card }) {
  const locale = useLocale();
  const img = p.images[0];
  return (
    <Link href={`/products/${p.slug}`} className="group absolute bottom-10 left-12 z-10 hidden w-[300px] flex-col bg-ground text-ink md:flex">
      <span className="flex flex-col gap-1.5 px-5 pt-5">
        <span className="font-serif text-[26px] font-light leading-none group-hover:text-brand">{p.name}</span>
        <span className="label text-muted">
          {modelNo(p.number) ? `${modelNo(p.number)} · ` : ''}
          {money(p.price, locale)}
        </span>
      </span>
      <span className="relative block aspect-square w-full">
        {img ? <Image src={img.url} alt={img.alt ?? p.name} fill sizes="300px" className="object-contain p-6 mix-blend-multiply transition duration-700 group-hover:scale-[1.04]" /> : null}
      </span>
    </Link>
  );
}

/**
 * Manu Atelier's sideways portrait: a model photo turned on its side across the full width, drifting with
 * the scroll. Phones show it upright. Copy (optional) sits centred underneath.
 */
function Sideways({ s }: { s: HomeSection }) {
  return (
    <section className="pt-24 md:pt-36">
      <div className="reveal relative h-[78svh] overflow-hidden bg-stone md:h-[92svh]" style={{ containerType: 'size' }}>
        <div className="parallax absolute inset-0" style={drift('8%')}>
          <div className="sideways-frame">{s.imageUrl ? <Image src={s.imageUrl} alt="" fill sizes="100vw" className="object-cover" /> : null}</div>
        </div>
        {/* Wide screens: the copy sits on the calm wall in the lower left of the turned photo. */}
        {s.title || s.subtitle ? (
          <div className="relative hidden h-full flex-col justify-end gap-5 p-12 pb-14 md:flex">
            {s.subtitle ? <p className="label text-ink-soft">{s.subtitle}</p> : null}
            {s.title ? <h2 className="display max-w-xl text-[64px]">{s.title}</h2> : null}
            <Cta s={s} />
          </div>
        ) : null}
      </div>
      {s.title || s.body || s.ctaLabel ? (
        <div className="reveal mx-auto mt-12 flex max-w-xl flex-col items-center gap-5 px-4 text-center md:hidden">
          {s.subtitle ? <p className="label text-muted">{s.subtitle}</p> : null}
          {s.title ? <h2 className="display text-[36px]">{s.title}</h2> : null}
          <Body html={s.body} className="text-[15px] leading-relaxed text-ink-soft" />
          <Cta s={s} className="link-underline" />
        </div>
      ) : null}
    </section>
  );
}

/** Photo beside text; `tinted` puts it on a stone band (atelier story). */
function Split({ s, tinted = false }: { s: HomeSection; tinted?: boolean }) {
  return (
    <section className={`mt-24 grid md:mt-36 md:grid-cols-2 ${tinted ? 'bg-stone' : 'mx-4 gap-6 md:mx-12'}`}>
      <div className="relative min-h-[420px] overflow-hidden bg-stone md:min-h-[680px]">
        <div className="parallax absolute inset-0" style={drift('7%')}>
          <Media s={s} sizes="(min-width: 768px) 50vw, 100vw" mobile={false} />
        </div>
      </div>
      <div className={`reveal flex flex-col justify-center gap-6 ${tinted ? 'p-8 md:p-20' : 'py-8 md:px-14'}`}>
        {s.subtitle ? <p className="label text-muted">{s.subtitle}</p> : null}
        {s.title ? <h2 className="display text-[36px] md:text-[56px]">{s.title}</h2> : null}
        <Body html={s.body} className="max-w-md text-[15px] leading-relaxed text-ink-soft" />
        <Cta s={s} />
      </div>
    </section>
  );
}

function Press({ s }: { s: HomeSection }) {
  const t = useTranslations('home');
  if (!s.press?.length) return null;
  const lead = s.press[0];
  return (
    <section className="reveal px-4 pt-24 md:px-12 md:pt-36">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
        <p className="label text-muted">{s.title ?? t('press')}</p>
        {lead.quote ? <blockquote className="font-serif text-3xl font-light leading-snug md:text-[44px]">“{lead.quote}”</blockquote> : null}
        <p className="label">
          {lead.url ? (
            <a href={lead.url} rel="noopener" target="_blank" className="hover:text-brand">
              {lead.publication}
            </a>
          ) : (
            lead.publication
          )}
        </p>
        {s.press.length > 1 ? (
          <ul className="label flex flex-wrap justify-center gap-x-10 gap-y-3 border-t border-line pt-8 text-muted">
            {s.press.slice(1).map((p) => (
              <li key={p.id}>{p.publication}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function Stockists({ s }: { s: HomeSection }) {
  const t = useTranslations('stockists');
  if (!s.stockists?.length) return null;
  return (
    <section className="reveal px-4 pt-24 md:px-12 md:pt-36">
      <div className="grid gap-8 border-t border-line pt-10 md:grid-cols-12">
        <p className="label text-muted md:col-span-3">{s.title ?? t('title')}</p>
        <ul className="grid gap-6 text-[15px] leading-relaxed sm:grid-cols-2 md:col-span-9 md:grid-cols-3">
          {s.stockists.map((st) => (
            <li key={st.id}>
              {st.url ? (
                <a href={st.url} rel="noopener" target="_blank" className="hover:text-brand">
                  {st.name}
                </a>
              ) : (
                st.name
              )}
              <br />
              <span className="text-muted">{st.city}</span>
            </li>
          ))}
          <li>
            maeyja.com
            <br />
            <span className="text-muted">{t('worldwide')}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Newsletter({ s }: { s: HomeSection }) {
  const t = useTranslations('newsletter');
  return (
    <section className="reveal mx-4 mt-24 flex flex-col items-center gap-8 border-t border-line pt-16 text-center md:mx-12 md:mt-36 md:pt-24">
      <h2 className="display max-w-3xl text-[32px] md:text-[48px]">{s.title ?? t('title')}</h2>
      <Body html={s.body ?? t('text')} className="max-w-md text-[15px] text-ink-soft" />
      <div className="w-full max-w-md text-left">
        <NewsletterForm source="home" />
      </div>
    </section>
  );
}
