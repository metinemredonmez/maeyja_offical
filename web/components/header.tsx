import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { modelNo } from '@/lib/format';
import { isExternal, mobileHref, panelOf, useNavLabel } from '@/lib/navigation';
import type { Navigation, NavHeaderItem, ProductCard, Stockist, User } from '@/lib/types';
import { LanguageSwitcher } from './language-switcher';
import { CartButton } from './cart/cart-button';
import { MobileMenu } from './mobile-menu';
import { HeaderShell } from './header-shell';
import { MegaItem } from './mega-menu';

type MenuModel = Pick<ProductCard, 'slug' | 'name' | 'number'>;

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
  const mobileLinks = items.map((i) => ({ href: mobileHref(i), label: label(i.label, i.key) }));
  const render = (i: NavHeaderItem) => {
    const text = label(i.label, i.key);
    if (i.kind !== 'link') return <PanelMenu key={i.id} item={i} label={text} models={models} stockists={stockists} contactEmail={contactEmail} />;
    return (
      <NavLink key={i.id} href={i.href} className="hover:text-brand">
        {text}
      </NavLink>
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

/** A shop page, or an https address opened in a new tab. */
function NavLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return isExternal(href) ? (
    <a href={href} rel="noopener" target="_blank" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * A picture menu under the header (Polène), all of it from the admin (Üst menü ve alt bilgi): a heading, links and up to
 * four pictures. The bags menu lists the models by itself and the stores menu the stockists.
 */
function PanelMenu({
  item,
  label,
  models,
  stockists,
  contactEmail,
}: {
  item: NavHeaderItem;
  label: string;
  models: MenuModel[];
  stockists: Stockist[];
  contactEmail: string | null;
}) {
  const tc = useTranslations('common');
  const ts = useTranslations('stockists');
  const name = useNavLabel();
  const panel = panelOf(item);
  const title = name(panel.title, panel.titleKey);
  // A model's colourways are separate pages (Petal Shoulder 24 twice): the menu lists each model once.
  const byModel = models.filter((m, i) => models.findIndex((x) => x.name === m.name) === i);
  const tileLabel = (tile: (typeof panel.tiles)[number]) => {
    const own = name(tile.label, '');
    if (own) return own;
    if (tile.href === '/contact' && contactEmail) return contactEmail;
    const model = models.find((m) => tile.href === `/products/${m.slug}`);
    return name({}, tile.key) || (model ? `${modelNo(model.number) ?? ''} ${model.name}`.trim() : '');
  };
  return (
    <MegaItem label={label}>
      <div className="grid grid-cols-4 gap-8 px-12 py-10">
        <div className="flex flex-col gap-5">
          {title ? <p className="font-serif text-xl font-light text-muted">{title}</p> : null}
          {item.kind === 'bags' && byModel.length ? (
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
          ) : null}
          {item.kind === 'stores' ? (
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
          ) : null}
          {panel.links.length ? (
            <ul className="flex flex-col gap-2.5 font-serif text-[17px]">
              {panel.links.map((l, i) => (
                <li key={i}>
                  <NavLink href={l.href} className="hover:text-brand">
                    {name(l.label, l.key)}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : null}
          {item.kind === 'bags' || item.kind === 'stores' ? (
            <Link href={item.kind === 'bags' ? '/products' : '/stockists'} className="link-underline mt-2 self-start">
              {tc('viewAll')}
            </Link>
          ) : null}
        </div>
        {panel.tiles.map((tile, i) => (
          <MenuTile key={i} href={tile.href} src={tile.image} label={tileLabel(tile)} />
        ))}
      </div>
    </MegaItem>
  );
}

function MenuTile({ href, src, label }: { href: string; src: string; label: string }) {
  return (
    <NavLink href={href} className="group flex flex-col gap-3">
      <span className="relative block aspect-[4/5] overflow-hidden bg-stone">
        <Image src={src} alt="" fill sizes="22vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
      </span>
      {label ? <span className="label text-ink">{label}</span> : null}
    </NavLink>
  );
}
