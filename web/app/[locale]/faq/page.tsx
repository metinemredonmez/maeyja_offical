import { getTranslations, setRequestLocale } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import { alternates } from '@/lib/seo';
import type { Faq } from '@/lib/types';
import { Accordion } from '@/components/product/accordion';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'faq' });
  return { title: t('title'), alternates: alternates('/faq', locale) };
}

export default async function FaqPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('faq');
  const faqs = await apiGet<Faq[]>('/content/faq', { locale, revalidate: 300 }).catch(() => []);
  const groups = [...new Set(faqs.map((f) => f.group ?? ''))];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) };
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 md:pt-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <h1 className="mb-12 font-serif text-5xl font-light leading-none md:text-[56px]">{t('title')}</h1>
      <div className="flex flex-col gap-12">
        {groups.map((g) => (
          <section key={g}>
            {g ? <h2 className="label mb-4 text-muted">{g}</h2> : null}
            <Accordion items={faqs.filter((f) => (f.group ?? '') === g).map((f) => ({ title: f.question, body: f.answer }))} />
          </section>
        ))}
      </div>
    </div>
  );
}
