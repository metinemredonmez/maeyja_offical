import { getTranslations } from 'next-intl/server';
import { currentUser } from '@/lib/api.server';
import { ProfileForms } from '@/components/account/profile-forms';

export default async function AccountOverviewPage() {
  const user = (await currentUser())!;
  const t = await getTranslations('account');
  const ta = await getTranslations('auth');
  return (
    <div className="flex flex-col gap-12">
      <div>
        <p className="font-serif text-3xl font-light">{t('welcome', { name: user.firstName ?? user.email })}</p>
        {!user.emailVerified ? <p className="mt-2 text-sm text-muted">{ta('unverified')}</p> : null}
      </div>
      <ProfileForms user={user} />
    </div>
  );
}
