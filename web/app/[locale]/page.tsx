import { setRequestLocale } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import type { HomeSection, InstagramPost, PublicSettings } from '@/lib/types';
import { HomeSections, InstagramCollage } from '@/components/home/sections';
import { alternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { alternates: alternates('/', locale) };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [sections, settings, posts] = await Promise.all([
    apiGet<HomeSection[]>('/content/home', { locale, revalidate: 60 }).catch(() => []),
    apiGet<PublicSettings>('/settings/public', { revalidate: 300 }).catch(() => null),
    apiGet<InstagramPost[]>('/content/instagram', { revalidate: 600 }).catch(() => []),
  ]);
  return (
    <>
      <HomeSections sections={sections} />
      <InstagramCollage url={settings?.store.instagram || null} posts={posts} />
    </>
  );
}
