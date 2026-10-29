import Image from 'next/image';
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

/** Half photo, half a quiet form (Polène-like): the image runs the full height beside the copy. */
export default async function ContactPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  const settings = await apiGet<PublicSettings>('/settings/public', { revalidate: 300 }).catch(() => null);
  return (
    <div className="md:grid md:min-h-[calc(100svh-69px)] md:grid-cols-2">
      <div className="relative aspect-[4/3] overflow-hidden bg-stone md:aspect-auto">
        <div className="parallax absolute inset-0">
          <Image src="/contact.webp" alt="" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
      </div>
      <div className="flex flex-col justify-center gap-12 px-5 py-14 md:px-16 lg:px-24">
        <div className="flex flex-col gap-5">
          <h1 className="display text-[40px] md:text-[56px]">{t('title')}</h1>
          <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">{t('text')}</p>
          {settings ? (
            <address className="label flex flex-col gap-2 not-italic text-ink-soft">
              <a href={`mailto:${settings.store.email}`} className="w-fit hover:text-brand">
                {settings.store.email}
              </a>
              {settings.store.phone ? (
                <a href={`tel:${settings.store.phone}`} className="w-fit hover:text-brand">
                  {settings.store.phone}
                </a>
              ) : null}
              <span className="text-muted">{settings.store.address}</span>
            </address>
          ) : null}
        </div>
        <div className="max-w-xl">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
