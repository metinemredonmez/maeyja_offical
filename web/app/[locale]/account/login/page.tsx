import { setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@/components/account/auth-form';

export const metadata = { robots: { index: false } };

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  return <AuthForm mode="login" next={next} />;
}
