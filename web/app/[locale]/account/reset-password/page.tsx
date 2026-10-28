import { setRequestLocale } from 'next-intl/server';
import { PasswordForms } from '@/components/account/password-forms';

export const metadata = { robots: { index: false } };

export default async function ResetPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token = '' } = await searchParams;
  return <PasswordForms mode="reset" token={token} />;
}
