'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, CopyIcon, KeyRoundIcon, PrinterIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldOffIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, FormError, SubmitButton } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { KeyValue, Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { USER_ROLE } from '@/lib/labels';
import { fullName } from '@/lib/format';
import { useLogout, useMe, useMfaBackupCodes, useMfaDisable, useMfaEnable, useMfaSetup, useMfaStatus } from '@/lib/queries/auth';
import { useChangePassword } from '@/lib/queries/system';
import { changePasswordSchema, mfaDisableSchema, mfaVerifySchema, type ChangePasswordValues, type MfaDisableValues, type MfaVerifyValues } from '@/lib/schemas/auth';
import type { MfaSetup } from '@/lib/types';

// ───────────── password ─────────────
function PasswordCard() {
  const change = useChangePassword();
  const form = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const onSubmit = form.handleSubmit(async (v) => {
    await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
    form.reset();
  });
  return (
    <Section title="Şifre değiştir" description="Değişiklik sonrası diğer cihazlardaki oturumlar kapatılır; bu oturum yenilenir.">
      <form id="password" onSubmit={onSubmit} className="grid max-w-md gap-4" noValidate>
        <FormError error={change.error} />
        <Field label="Mevcut şifre" error={form.formState.errors.currentPassword} htmlFor="currentPassword" required>
          <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register('currentPassword')} />
        </Field>
        <Field label="Yeni şifre" error={form.formState.errors.newPassword} htmlFor="newPassword" required hint="En az 8 karakter, harf ve rakam">
          <Input id="newPassword" type="password" autoComplete="new-password" {...form.register('newPassword')} />
        </Field>
        <Field label="Yeni şifre (tekrar)" error={form.formState.errors.confirm} htmlFor="confirm" required>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <SubmitButton loading={change.isPending} className="justify-self-start">
          <KeyRoundIcon /> Şifreyi güncelle
        </SubmitButton>
      </form>
    </Section>
  );
}

// ───────────── two-factor ─────────────
function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');
  const copy = () => navigator.clipboard.writeText(text).then(() => toast.success('Kodlar kopyalandı'));
  const print = () => {
    const w = window.open('', '_blank', 'width=480,height=600');
    if (!w) return;
    w.document.write(`<title>MAEYJA yedek kodlar</title><pre style="font:14px/1.8 ui-monospace,monospace;padding:24px">MAEYJA yönetim paneli — yedek kodlar\n\n${codes.join('\n')}\n\nHer kod bir kez kullanılır.</pre>`);
    w.document.close();
    w.print();
  };
  return (
    <div className="space-y-3">
      <div role="alert" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
        <p>
          Bu kodlar <strong>yalnızca bir kez</strong> gösterilir. Kimlik doğrulama uygulamasına erişemediğinizde giriş için kullanın; her kod tek kullanımlıktır. Güvenli bir yerde saklayın.
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/40 p-3 font-mono text-sm tracking-wider select-all">
        {codes.map((c) => (
          <li key={c} className="rounded bg-background px-2 py-1 text-center ring-1 ring-black/5">
            {c}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <CopyIcon /> Kopyala
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={print}>
          <PrinterIcon /> Yazdır
        </Button>
      </div>
      <Label className="flex cursor-pointer items-start gap-2 text-sm">
        <Checkbox checked={saved} onCheckedChange={(v) => setSaved(Boolean(v))} className="mt-0.5" />
        Kodları güvenli bir yere kaydettim.
      </Label>
      <div className="flex justify-end">
        <Button type="button" disabled={!saved} onClick={onDone}>
          <CheckIcon /> Tamam
        </Button>
      </div>
    </div>
  );
}

function SetupDialog({ onClose }: { onClose: () => void }) {
  const setup = useMfaSetup();
  const enable = useMfaEnable();
  const logout = useLogout();
  const [data, setData] = useState<MfaSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const form = useForm<MfaVerifyValues>({ resolver: zodResolver(mfaVerifySchema), defaultValues: { code: '' } });
  const requested = useRef(false);

  // Request the secret once when the dialog opens.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    setup.mutate(undefined, { onSuccess: setData });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = form.handleSubmit(async (v) => {
    const r = await enable.mutateAsync({ code: v.code });
    setCodes(r.backupCodes);
  });
  const copySecret = () => data && navigator.clipboard.writeText(data.secret).then(() => toast.success('Anahtar kopyalandı'));

  return (
    <Dialog open onOpenChange={(o) => !o && !codes && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!codes}>
        <DialogHeader>
          <DialogTitle>{codes ? 'Yedek kodlarınız' : 'İki adımlı doğrulamayı kur'}</DialogTitle>
          <DialogDescription>{codes ? 'Kurulum tamamlandı. Kodları kaydedin; ardından kodla yeniden giriş yapacaksınız.' : 'Google Authenticator, 1Password veya Authy gibi bir uygulama ile QR kodu tarayın, ardından üretilen 6 haneli kodu girin.'}</DialogDescription>
        </DialogHeader>
        {codes ? (
          <BackupCodes
            codes={codes}
            onDone={() => {
              // Enabling revoked every session; the current token has no second factor yet → sign in again with the code.
              toast.success('İki adımlı doğrulama açıldı — yeniden giriş yapın');
              void logout();
            }}
          />
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormError error={setup.error ?? enable.error} />
            {data ? (
              <div className="flex flex-col items-center gap-3">
                {/* qrDataUrl is a data: PNG produced by the backend. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.qrDataUrl} alt="TOTP QR kodu" width={200} height={200} className="rounded-lg border bg-white p-2" />
                <div className="w-full">
                  <p className="mb-1 text-xs text-muted-foreground">QR taranamıyorsa anahtarı elle girin:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg border bg-muted/40 px-2.5 py-1.5 font-mono text-xs tracking-wider select-all">{data.secret}</code>
                    <Button type="button" variant="outline" size="icon-sm" onClick={copySecret} aria-label="Anahtarı kopyala">
                      <CopyIcon />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto size-[200px] animate-pulse rounded-lg bg-muted" aria-busy="true" />
            )}
            <Field label="Uygulamadaki 6 haneli kod" error={form.formState.errors.code} htmlFor="mfa-code" required>
              <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="font-mono tracking-widest" disabled={!data} {...form.register('code')} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Vazgeç
              </Button>
              <SubmitButton loading={enable.isPending} disabled={!data}>
                <ShieldCheckIcon /> Etkinleştir
              </SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DisableDialog({ onClose }: { onClose: () => void }) {
  const disable = useMfaDisable();
  const form = useForm<MfaDisableValues>({ resolver: zodResolver(mfaDisableSchema), defaultValues: { password: '', code: '' } });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = mfaDisableSchema.parse(raw);
    await disable.mutateAsync(v);
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>İki adımlı doğrulamayı kapat</DialogTitle>
          <DialogDescription>Hesabınız yalnızca şifre ile korunacak. Onaylamak için şifrenizi ve güncel bir kodu girin.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={disable.error} />
          <Field label="Şifre" error={form.formState.errors.password} htmlFor="dis-password" required>
            <Input id="dis-password" type="password" autoComplete="current-password" {...form.register('password')} />
          </Field>
          <Field label="Doğrulama kodu" error={form.formState.errors.code} htmlFor="dis-code" required hint="6 haneli kod veya yedek kod">
            <Input id="dis-code" inputMode="numeric" autoComplete="one-time-code" className="font-mono tracking-widest" {...form.register('code')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={disable.isPending} className="bg-[#A3121B] text-white hover:bg-[#8c0f17]">
              <ShieldOffIcon /> Kapat
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RegenerateDialog({ onClose }: { onClose: () => void }) {
  const regen = useMfaBackupCodes();
  const [codes, setCodes] = useState<string[] | null>(null);
  const form = useForm<MfaVerifyValues>({ resolver: zodResolver(mfaVerifySchema), defaultValues: { code: '' } });
  const onSubmit = form.handleSubmit(async (v) => {
    const r = await regen.mutateAsync({ code: v.code });
    setCodes(r.backupCodes);
  });
  return (
    <Dialog open onOpenChange={(o) => !o && !codes && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!codes}>
        <DialogHeader>
          <DialogTitle>{codes ? 'Yeni yedek kodlar' : 'Yedek kodları yenile'}</DialogTitle>
          <DialogDescription>{codes ? 'Eski kodlar artık geçersiz.' : 'Mevcut tüm yedek kodlar iptal edilir ve 8 yeni kod üretilir.'}</DialogDescription>
        </DialogHeader>
        {codes ? (
          <BackupCodes codes={codes} onDone={onClose} />
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormError error={regen.error} />
            <Field label="Uygulamadaki 6 haneli kod" error={form.formState.errors.code} htmlFor="regen-code" required>
              <Input id="regen-code" inputMode="numeric" autoComplete="one-time-code" className="font-mono tracking-widest" autoFocus {...form.register('code')} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Vazgeç
              </Button>
              <SubmitButton loading={regen.isPending}>Yenile</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MfaCard({ mandatory }: { mandatory: boolean }) {
  const status = useMfaStatus();
  const [dialog, setDialog] = useState<'setup' | 'disable' | 'regen' | null>(null);
  return (
    <Section
      title="İki adımlı doğrulama"
      description="Girişte şifreye ek olarak kimlik doğrulama uygulamasından 6 haneli kod istenir (TOTP)."
      actions={status.data ? status.data.enabled ? <ToneBadge tone="success" dot>Açık</ToneBadge> : <ToneBadge tone="warning" dot>Kapalı</ToneBadge> : null}
    >
      {mandatory && !status.data?.enabled && (
        <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">İki adımlı doğrulama kurulumu zorunlu</p>
            <p className="text-xs">Yönetim paneli personel hesapları için 2FA zorunlu. Kurulumu tamamlamadan diğer sayfalara erişemezsiniz.</p>
          </div>
        </div>
      )}
      <QueryState query={status} loading={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        {(s) => (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <dl className="text-sm">
              <KeyValue label="Durum">{s.enabled ? 'Etkin' : 'Kurulmadı'}</KeyValue>
              {s.enabled && <KeyValue label="Yedek kod">{s.backupCodesLeft} kullanılmamış kod</KeyValue>}
            </dl>
            <div className="flex flex-wrap gap-2">
              {s.enabled ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setDialog('regen')}>
                    Yedek kodları yenile
                  </Button>
                  <Button variant="outline" size="sm" className="text-[#A3121B]" onClick={() => setDialog('disable')}>
                    <ShieldOffIcon /> Kapat
                  </Button>
                </>
              ) : (
                <Button onClick={() => setDialog('setup')}>
                  <ShieldCheckIcon /> Kur
                </Button>
              )}
            </div>
          </div>
        )}
      </QueryState>
      {dialog === 'setup' && <SetupDialog onClose={() => setDialog(null)} />}
      {dialog === 'disable' && <DisableDialog onClose={() => setDialog(null)} />}
      {dialog === 'regen' && <RegenerateDialog onClose={() => setDialog(null)} />}
    </Section>
  );
}

function ProfileInner() {
  const me = useMe();
  const mandatory = useSearchParams().get('mfa') === 'setup';
  return (
    <>
      <PageHeader title="Profil" description="Hesap bilgileriniz ve güvenlik ayarları." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Section title="Hesap">
          <QueryState query={me}>
            {(u) => (
              <dl>
                <KeyValue label="Ad">{fullName(u)}</KeyValue>
                <KeyValue label="E-posta">{u.email}</KeyValue>
                <KeyValue label="Rol">{USER_ROLE[u.role]}</KeyValue>
                <KeyValue label="2FA">{u.mfaEnabled ? 'Açık' : 'Kapalı'}</KeyValue>
              </dl>
            )}
          </QueryState>
        </Section>
        <div className="space-y-5">
          <MfaCard mandatory={mandatory} />
          <PasswordCard />
        </div>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileInner />
    </Suspense>
  );
}
