import { setRequestLocale } from 'next-intl/server';
import { PasswordForms } from '@/components/account/password-forms';

export const metadata = { robots: { index: false } };

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PasswordForms mode="forgot" />;
}
