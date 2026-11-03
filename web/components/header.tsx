import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { modelNo } from '@/lib/format';
import { isExternal, KIND_HREF, useNavLabel } from '@/lib/navigation';
import type { Navigation, NavHeaderItem, ProductCard, Stockist, User } from '@/lib/types';
import { LanguageSwitcher } from './language-switcher';
import { CartButton } from './cart/cart-button';
import { MobileMenu } from './mobile-menu';
import { HeaderShell } from './header-shell';
import { MegaItem } from './mega-menu';

type MenuModel = Pick<ProductCard, 'slug' | 'name' | 'number'>;

/** Models shown as still-life tiles in the Bags menu (pictures in public/menu/bags-{picture}.webp). */
const BAG_TILES = [
  { slug: 'petal-box-chili', picture: 'origami' },
  { slug: 'petal-bucket-12-chili', picture: 'tulip' },
  { slug: 'petal-shoulder-24-botanic', picture: 'frame' },
];

export function Header({
  announcement,
  user,
  models,
  stockists,
  contactEmail,
  nav,
}: {
  announcement: string | null;
  user: User | null;
  models: MenuModel[];
  stockists: Stockist[];
  contactEmail: string | null;
  nav: Navigation['header'];
}) {
  const t = useTranslations('nav');
  const label = useNavLabel();
  const items = nav.items.filter((i) => i.visible);
  const mobileLinks = items.map((i) => ({ href: i.kind === 'link' ? i.href : KIND_HREF[i.kind], label: label(i.label, i.key) }));
  const render = (i: NavHeaderItem) => {
    const text = label(i.label, i.key);
    if (i.kind === 'bags') return <BagsMenu key={i.id} label={text} models={models} />;
    if (i.kind === 'expertise') return <ExpertiseMenu key={i.id} label={text} />;
    if (i.kind === 'stores') return <StoresMenu key={i.id} label={text} stockists={stockists} contactEmail={contactEmail} />;
    return isExternal(i.href) ? (
      <a key={i.id} href={i.href} rel="noopener" target="_blank" className="hover:text-brand">
        {text}
      </a>
    ) : (
      <Link key={i.id} href={i.href} className="hover:text-brand">
        {text}
      </Link>
    );
  };
  return (
    <HeaderShell>
      {announcement ? <div className="label bg-ink px-4 py-2.5 text-center text-ground">{announcement}</div> : null}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 md:px-12 md:py-5">
        <nav aria-label={t('menu')} className="label hidden items-center gap-8 md:flex">
          {items.filter((i) => i.side === 'left').map(render)}
        </nav>
        <MobileMenu links={mobileLinks} />
        <Link href="/" aria-label={t('home')} data-wordmark className="wordmark pl-[0.42em] text-lg tracking-logo md:text-xl">
          MAEYJA
        </Link>
        <div className="label flex items-center justify-end gap-5 md:gap-7">
          {items.some((i) => i.side === 'right') ? <div className="hidden items-center gap-7 md:flex">{items.filter((i) => i.side === 'right').map(render)}</div> : null}
          {nav.languages ? <LanguageSwitcher /> : null}
          {nav.account ? (
            <Link href={user ? '/account' : '/account/login'} className="hidden hover:text-brand md:inline">
              {user ? (user.firstName ?? t('account')) : t('account')}
            </Link>
          ) : null}
          <CartButton label={t('cart')} />
        </div>
      </div>
    </HeaderShell>
  );
}

function BagsMenu({ label, models }: { label: string; models: MenuModel[] }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  // A model's colourways are separate pages (Petal Shoulder 24 twice): the menu lists each model once.
  const byModel = models.filter((m, i) => models.findIndex((x) => x.name === m.name) === i);
  return (
    <MegaItem label={label}>
      <div className="grid grid-cols-4 gap-8 px-12 py-10">
        <div className="flex flex-col gap-5">
          <p className="font-serif text-xl font-light text-muted">{t('byModel')}</p>
          <ul className="flex flex-col gap-2.5 font-serif text-[17px]">
            {byModel.map((m) => (
              <li key={m.slug}>
                <Link href={`/products/${m.slug}`} className="hover:text-brand">
                  {modelNo(m.number) ? <span className="mr-2 text-muted">{modelNo(m.number)}</span> : null}
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/products" className="link-underline mt-2 self-start">
            {tc('viewAll')}
          </Link>
        </div>
        {BAG_TILES.map(({ slug, picture }) => {
          const m = models.find((x) => x.slug === slug);
          return m ? <MenuTile key={slug} href={`/products/${slug}`} src={`/menu/bags-${picture}.webp`} label={`${modelNo(m.number) ?? ''} ${m.name}`.trim()} /> : null;
        })}
      </div>
    </MegaItem>
  );
}

function ExpertiseMenu({ label }: { label: string }) {
  const t = useTranslations('nav');
  const th = useTranslations('home');
  return (
    <MegaItem label={label}>
      <div className="grid grid-cols-4 gap-8 px-12 py-10">
        <div className="flex flex-col gap-5">
          <p className="font-serif text-xl font-light text-muted">{t('bags')}</p>
          <ul className="flex flex-col gap-2.5 font-serif text-[17px]">
            <li><Link href="/expertise#design" className="hover:text-brand">{t('design')}</Link></li>
            <li><Link href="/expertise#materials" className="hover:text-brand">{t('materials')}</Link></li>
            <li><Link href="/expertise#craft" className="hover:text-brand">{t('craft')}</Link></li>
            <li><Link href="/expertise#artisans" className="hover:text-brand">{t('artisans')}</Link></li>
            <li><Link href="/about" className="hover:text-brand">{th('ourStory')}</Link></li>
          </ul>
        </div>
        <MenuTile href="/expertise#craft" src="/menu/expertise-craft.webp" label={t('craft')} />
        <MenuTile href="/about" src="/menu/expertise-story.webp" label={th('ourStory')} />
      </div>
    </MegaItem>
  );
}

function StoresMenu({ label, stockists, contactEmail }: { label: string; stockists: Stockist[]; contactEmail: string | null }) {
  const tc = useTranslations('common');
  const ts = useTranslations('stockists');
  const tf = useTranslations('footer');
  return (
    <MegaItem label={label}>
      <div className="grid grid-cols-4 gap-8 px-12 py-10">
        <div className="flex flex-col gap-5">
          <p className="font-serif text-xl font-light text-muted">{ts('title')}</p>
          <ul className="flex flex-col gap-4 font-serif text-[17px]">
            {stockists.map((s) => (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} rel="noopener" target="_blank" className="hover:text-brand">
                    {s.name}
                  </a>
                ) : (
                  s.name
                )}
                <span className="block font-sans text-xs text-muted">{s.city}</span>
              </li>
            ))}
            <li>
              <Link href="/products" className="hover:text-brand">
                maeyja.com
              </Link>
              <span className="block font-sans text-xs text-muted">{ts('worldwide')}</span>
            </li>
          </ul>
          <Link href="/stockists" className="link-underline mt-2 self-start">
            {tc('viewAll')}
          </Link>
        </div>
        {stockists[0] ? (
          <StoreTile heading={stockists[0].city} href="/stockists" src="/menu/store-city.webp" title={stockists[0].name} line={stockists[0].address} />
        ) : null}
        <StoreTile heading={ts('online')} href="/products" src="/menu/store-shelves.webp" title="maeyja.com" line={ts('worldwide')} />
        <StoreTile heading={tf('contact')} href="/contact" src="/menu/store-contact.webp" title={contactEmail ?? tf('contact')} line={null} />
      </div>
    </MegaItem>
  );
}

function MenuTile({ href, src, label }: { href: string; src: string; label: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-3">
      <span className="relative block aspect-[4/5] overflow-hidden bg-stone">
        <Image src={src} alt="" fill sizes="22vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
      </span>
      <span className="label text-ink">{label}</span>
    </Link>
  );
}

/** A column of the Stores menu (Polène): the place in muted serif, a picture, then the name and one line under it. */
function StoreTile({ heading, href, src, title, line }: { heading: string; href: string; src: string; title: string; line: string | null }) {
  return (
    <Link href={href} className="group flex flex-col gap-3">
      <span className="font-serif text-xl font-light text-muted">{heading}</span>
      <span className="relative block aspect-[4/5] overflow-hidden bg-stone">
        <Image src={src} alt="" fill sizes="22vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
      </span>
      <span className="label text-ink group-hover:text-brand">{title}</span>
      {line ? <span className="-mt-1.5 text-xs text-muted">{line}</span> : null}
    </Link>
  );
}
