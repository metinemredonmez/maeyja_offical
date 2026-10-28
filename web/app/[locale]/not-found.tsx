import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('common');
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="label text-muted">404</p>
      <h1 className="font-serif text-5xl font-light">{t('notFound')}</h1>
      <p className="max-w-md text-[15px] text-ink-soft">{t('notFoundText')}</p>
      <Link href="/products" className="btn-outline">
        {t('discover')}
      </Link>
    </div>
  );
}
