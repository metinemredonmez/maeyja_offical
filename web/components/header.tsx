import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { modelNo } from '@/lib/format';
import type { ProductCard, Stockist, User } from '@/lib/types';
import { LanguageSwitcher } from './language-switcher';
import { CartButton } from './cart/cart-button';
import { MobileMenu } from './mobile-menu';
import { HeaderShell } from './header-shell';
import { MegaItem } from './mega-menu';

type MenuModel = Pick<ProductCard, 'slug' | 'name' | 'number'>;

/** Models shown as still-life tiles in the Bags menu (pictures in public/menu/bags-{slug}.webp). */
const BAG_TILES = ['origami', 'tulip', 'frame'];

export function Header({
  announcement,
  user,
  models,
  stockists,
  contactEmail,
}: {
  announcement: string | null;
  user: User | null;
  models: MenuModel[];
  stockists: Stockist[];
  contactEmail: string | null;
}) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const ts = useTranslations('stockists');
  const th = useTranslations('home');
  const tf = useTranslations('footer');
  const mobileLinks = [
    { href: '/products', label: t('bags') },
    { href: '/expertise', label: t('expertise') },
    { href: '/journal', label: t('journal') },
    { href: '/stockists', label: t('stores') },
  ];
  return (
    <HeaderShell>
      {announcement ? <div className="label bg-ink px-4 py-2.5 text-center text-ground">{announcement}</div> : null}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 md:px-12 md:py-5">
        <nav aria-label={t('menu')} className="label hidden items-center gap-8 md:flex">
          <MegaItem label={t('bags')}>
            <div className="grid grid-cols-4 gap-8 px-12 py-10">
              <div className="flex flex-col gap-5">
                <p className="font-serif text-xl font-light text-muted">{t('byModel')}</p>
                <ul className="flex flex-col gap-2.5 font-serif text-[17px]">
                  {models.map((m) => (
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
              {BAG_TILES.map((slug) => {
                const m = models.find((x) => x.slug === slug);
                return m ? <MenuTile key={slug} href={`/products/${slug}`} src={`/menu/bags-${slug}.webp`} label={`${modelNo(m.number) ?? ''} ${m.name}`.trim()} /> : null;
              })}
            </div>
          </MegaItem>
          <MegaItem label={t('expertise')}>
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
          <Link href="/journal" className="hover:text-brand">
            {t('journal')}
          </Link>
        </nav>
        <MobileMenu links={mobileLinks} />
        <Link href="/" aria-label={t('home')} data-wordmark className="wordmark pl-[0.42em] text-lg tracking-logo md:text-xl">
          MAEYJA
        </Link>
        <div className="label flex items-center justify-end gap-5 md:gap-7">
          <div className="hidden md:block">
            <MegaItem label={t('stores')}>
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
                <StoreTile heading={ts('online')} href="/products" src="/menu/store-online.webp" title="maeyja.com" line={ts('worldwide')} />
                <StoreTile heading={tf('contact')} href="/contact" src="/menu/store-contact.webp" title={contactEmail ?? tf('contact')} line={null} />
              </div>
            </MegaItem>
          </div>
          <LanguageSwitcher />
          <Link href={user ? '/account' : '/account/login'} className="hidden hover:text-brand md:inline">
            {user ? (user.firstName ?? t('account')) : t('account')}
          </Link>
          <CartButton label={t('cart')} />
        </div>
      </div>
    </HeaderShell>
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
