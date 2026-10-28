import { getTranslations, setRequestLocale } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import { alternates } from '@/lib/seo';
import type { PublicSettings } from '@/lib/types';
import { ContactForm } from '@/components/contact-form';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('title'), alternates: alternates('/contact', locale) };
}

export default async function ContactPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  const settings = await apiGet<PublicSettings>('/settings/public', { revalidate: 300 }).catch(() => null);
  return (
    <div className="grid gap-12 px-4 pt-12 md:grid-cols-12 md:px-12 md:pt-20">
      <div className="flex flex-col gap-6 md:col-span-4">
        <h1 className="font-serif text-5xl font-light leading-none md:text-[56px]">{t('title')}</h1>
        <p className="text-[15px] leading-relaxed text-ink-soft">{t('text')}</p>
        {settings ? (
          <address className="flex flex-col gap-1 text-sm not-italic text-muted">
            <a href={`mailto:${settings.store.email}`} className="hover:text-ink">{settings.store.email}</a>
            {settings.store.phone ? <a href={`tel:${settings.store.phone}`} className="hover:text-ink">{settings.store.phone}</a> : null}
            <span>{settings.store.address}</span>
          </address>
        ) : null}
      </div>
      <div className="md:col-span-6 md:col-start-6">
        <ContactForm />
      </div>
    </div>
  );
}
