import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import { PREVIEW_HEADER } from '@/lib/maintenance';
import type { HomeSection, InstagramPost, PublicSettings } from '@/lib/types';
import { HomeSections } from '@/components/home/sections';
import { alternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { alternates: alternates('/', locale) };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The admin's preview sees its changes at once; everyone else gets the minute-long cache.
  const preview = (await headers()).get(PREVIEW_HEADER) === '1';
  const [sections, settings, posts] = await Promise.all([
    apiGet<HomeSection[]>('/content/home', { locale, revalidate: preview ? undefined : 60 }).catch(() => []),
    apiGet<PublicSettings>('/settings/public', { revalidate: 60 }).catch(() => null),
    apiGet<InstagramPost[]>('/content/instagram', { revalidate: 600 }).catch(() => []),
  ]);
  return <HomeSections sections={sections} instagram={{ url: settings?.store.instagram || null, posts }} />;
}
