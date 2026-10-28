import { setRequestLocale } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import type { HomeSection } from '@/lib/types';
import { HomeSections } from '@/components/home/sections';
import { alternates } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { alternates: alternates('/', locale) };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sections = await apiGet<HomeSection[]>('/content/home', { locale, revalidate: 60 }).catch(() => []);
  return <HomeSections sections={sections} />;
}
