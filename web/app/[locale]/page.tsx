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
  return (
    <>
      {/* Canan's page 1: the big wordmark at the top; the bar's small one takes over once this scrolls away. */}
      <h1 data-masthead className="flex justify-center px-4 pt-2 pb-10 md:pt-4 md:pb-16">
        <span className="wordmark pl-[0.42em] text-[clamp(38px,4.6vw,76px)] leading-none tracking-logo">MAEYJA</span>
      </h1>
      <HomeSections sections={sections} />
    </>
  );
}
