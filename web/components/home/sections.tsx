import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { HomeSection } from '@/lib/types';
import { ProductGrid } from '@/components/product/product-grid';
import { NewsletterForm } from '@/components/newsletter-form';

/** Renders the admin-managed homepage sections in order. Unknown types are skipped. */
export function HomeSections({ sections }: { sections: HomeSection[] }) {
  return (
    <>
      {sections.map((s, i) => {
        switch (s.type) {
          case 'HERO':
            return <Hero key={s.id} s={s} first={i === 0} />;
          case 'FEATURED_PRODUCTS':
          case 'COLLECTION':
            return <Featured key={s.id} s={s} />;
          case 'CRAFT_STORY':
            return <CraftStory key={s.id} s={s} />;
          case 'EDITORIAL':
            return <Editorial key={s.id} s={s} />;
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

const Cta = ({ s, className = 'btn-primary self-start' }: { s: HomeSection; className?: string }) =>
  s.ctaUrl && s.ctaLabel ? (
    <Link href={s.ctaUrl} className={className}>
      {s.ctaLabel}
    </Link>
  ) : null;

/** Passe-partout hero: framed media with the headline sitting on it. Video is muted and loops. */
function Hero({ s, first }: { s: HomeSection; first: boolean }) {
  return (
    <section className="px-4 pt-6 md:px-12 md:pt-8">
      <div className="relative flex min-h-[70vh] items-end overflow-hidden bg-stone md:min-h-[760px]">
        {s.videoUrl ? (
          <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline poster={s.imageUrl ?? undefined} aria-hidden="true">
            <source src={s.videoUrl} />
          </video>
        ) : s.imageUrl ? (
          <>
            <Image src={s.imageUrl} alt="" fill priority={first} sizes="100vw" className="hidden object-cover md:block" />
            <Image src={s.mobileImageUrl ?? s.imageUrl} alt="" fill priority={first} sizes="100vw" className="object-cover md:hidden" />
          </>
        ) : null}
        <div className="relative flex max-w-2xl flex-col gap-5 p-8 md:p-14">
          {s.title ? <h1 className="font-serif text-5xl font-light leading-none tracking-tight md:text-[80px]">{s.title}</h1> : null}
          {s.subtitle ? <p className="text-[15px] text-ink-soft">{s.subtitle}</p> : null}
          <Cta s={s} />
        </div>
      </div>
    </section>
  );
}

function Featured({ s }: { s: HomeSection }) {
  const t = useTranslations('common');
  if (!s.products?.length) return null;
  const collectionSlug = (s.payload as { collectionSlug?: string } | null)?.collectionSlug;
  return (
    <section className="px-4 pt-24 md:px-12 md:pt-32">
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        {s.title ? <h2 className="font-serif text-4xl font-light">{s.title}</h2> : <span />}
        <Link href={collectionSlug ? `/collections/${collectionSlug}` : '/products'} className="link-underline">
          {t('viewAll')}
        </Link>
      </div>
      <ProductGrid products={s.products} columns={s.products.length >= 4 ? 4 : 3} />
    </section>
  );
}

function CraftStory({ s }: { s: HomeSection }) {
  return (
    <section className="mt-24 grid bg-stone md:mt-32 md:grid-cols-2">
      <div className="ph relative min-h-[360px] md:min-h-[640px]">{s.imageUrl ? <Image src={s.imageUrl} alt="" fill sizes="50vw" className="object-cover" /> : null}</div>
      <div className="flex flex-col justify-center gap-7 p-8 md:p-20">
        <p className="label text-muted">{s.subtitle}</p>
        {s.title ? <h2 className="font-serif text-4xl font-light leading-tight md:text-5xl">{s.title}</h2> : null}
        {s.body ? <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">{s.body}</p> : null}
        <Cta s={s} className="link-underline self-start" />
      </div>
    </section>
  );
}

function Editorial({ s }: { s: HomeSection }) {
  return (
    <section className="px-4 pt-24 md:px-12 md:pt-32">
      <div className="grid items-end gap-6 md:grid-cols-12">
        <div className="ph relative aspect-[4/5] md:col-span-7">{s.imageUrl ? <Image src={s.imageUrl} alt="" fill sizes="60vw" className="object-cover" /> : null}</div>
        <div className="flex flex-col gap-5 md:col-span-4 md:col-start-9 md:pb-10">
          {s.title ? <h2 className="font-serif text-4xl font-light leading-tight">{s.title}</h2> : null}
          {s.body ? <p className="text-[15px] leading-relaxed text-ink-soft">{s.body}</p> : null}
          <Cta s={s} className="link-underline self-start" />
        </div>
      </div>
    </section>
  );
}

function Press({ s }: { s: HomeSection }) {
  const t = useTranslations('home');
  if (!s.press?.length) return null;
  const lead = s.press[0];
  return (
    <section className="px-4 pt-24 md:px-12 md:pt-32">
      <div className="grid gap-10 md:grid-cols-12">
        <div className="flex flex-col gap-6 md:col-span-7 md:col-start-2">
          <p className="label text-muted">{s.title ?? t('press')}</p>
          {lead.quote ? <blockquote className="font-serif text-3xl font-light italic leading-snug md:text-[44px]">“{lead.quote}”</blockquote> : null}
          <p className="label">{lead.url ? <a href={lead.url} rel="noopener" target="_blank" className="hover:text-brand">{lead.publication}</a> : lead.publication}</p>
        </div>
        {s.press.length > 1 ? (
          <ul className="label flex flex-col gap-3 text-muted md:col-span-3 md:col-start-10 md:border-l md:border-line md:pl-8">
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
    <section className="px-4 pt-24 md:px-12 md:pt-32">
      <div className="grid gap-8 border-t border-line pt-10 md:grid-cols-12">
        <p className="label text-muted md:col-span-3">{s.title ?? t('title')}</p>
        <ul className="grid gap-6 text-[15px] leading-relaxed sm:grid-cols-2 md:col-span-9 md:grid-cols-3">
          {s.stockists.map((st) => (
            <li key={st.id}>
              {st.url ? <a href={st.url} rel="noopener" target="_blank" className="hover:text-brand">{st.name}</a> : st.name}
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
    <section className="mx-4 mt-24 grid gap-10 border border-ink p-8 md:mx-12 md:mt-32 md:grid-cols-2 md:items-center md:p-20">
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-4xl font-light leading-tight">{s.title ?? t('title')}</h2>
        <p className="text-[15px] text-ink-soft">{s.body ?? t('text')}</p>
      </div>
      <NewsletterForm source="home" />
    </section>
  );
}
