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

export function Header({ announcement, user, models, stockists }: { announcement: string | null; user: User | null; models: MenuModel[]; stockists: Stockist[] }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const ts = useTranslations('stockists');
  const th = useTranslations('home');
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
              <MenuTile href={models[0] ? `/products/${models[0].slug}` : '/products'} src="/menu/bags-studio.webp" label={models[0] ? `${modelNo(models[0].number) ?? ''} ${models[0].name}`.trim() : t('bags')} />
              <MenuTile href="/products" src="/menu/bags-all.webp" label={tc('viewAll')} />
              <MenuTile href="/expertise" src="/menu/expertise.webp" label={t('expertise')} />
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
              <MenuTile href="/expertise" src="/menu/expertise.webp" label={t('expertise')} />
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
                <MenuTile href="/stockists" src="/menu/stores.webp" label={ts('title')} />
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
