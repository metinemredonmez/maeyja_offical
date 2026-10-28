'use client';

import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon, MailIcon, ServerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FormError, SubmitButton, SwitchField } from '@/components/shared/form';
import { RichText } from '@/components/shared/rich-text';
import { useSaveMailAccount } from '@/lib/queries/mail';
import { mailAccountSchema, newMailAccountSchema, type MailAccountFormValues } from '@/lib/schemas/mail';
import type { MailAccount } from '@/lib/types';

type ServerFields = Pick<MailAccountFormValues, 'imapHost' | 'imapPort' | 'imapSecure' | 'smtpHost' | 'smtpPort' | 'smtpSecure' | 'allowSelfSigned'>;

const PRESETS: { key: string; label: string; icon: React.ReactNode; values: ServerFields }[] = [
  {
    key: 'local',
    label: 'Bu sunucu (maeyja/hazal)',
    icon: <ServerIcon />,
    values: { imapHost: '127.0.0.1', imapPort: '993', imapSecure: true, smtpHost: '127.0.0.1', smtpPort: '465', smtpSecure: true, allowSelfSigned: true },
  },
  {
    key: 'gmail',
    label: 'Gmail',
    icon: <MailIcon />,
    values: { imapHost: 'imap.gmail.com', imapPort: '993', imapSecure: true, smtpHost: 'smtp.gmail.com', smtpPort: '465', smtpSecure: true, allowSelfSigned: false },
  },
];

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];

export function MailAccountDialog({ account, onClose }: { account: MailAccount | null; onClose: () => void }) {
  const save = useSaveMailAccount();
  const schema = account ? mailAccountSchema : newMailAccountSchema;
  const form = useForm<MailAccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: account?.email ?? '',
      password: '',
      fromName: account?.fromName ?? '',
      imapHost: account?.imapHost ?? '',
      imapPort: String(account?.imapPort ?? 993),
      imapSecure: account?.imapSecure ?? true,
      smtpHost: account?.smtpHost ?? '',
      smtpPort: String(account?.smtpPort ?? 465),
      smtpSecure: account?.smtpSecure ?? true,
      allowSelfSigned: account?.allowSelfSigned ?? false,
      isActive: account?.isActive ?? true,
      isDefault: account?.isDefault ?? false,
      signatureHtml: account?.signatureHtml ?? '',
    },
  });
  const errors = form.formState.errors;
  const [imapHost, smtpHost, allowSelfSigned] = useWatch({ control: form.control, name: ['imapHost', 'smtpHost', 'allowSelfSigned'] });
  const isGmail = /(^|\.)(gmail|googlemail)\.com$/i.test(imapHost.trim()) || /(^|\.)(gmail|googlemail)\.com$/i.test(smtpHost.trim());
  const remoteSelfSigned = allowSelfSigned && [imapHost, smtpHost].some((h) => h.trim() && !LOCAL_HOSTS.includes(h.trim()));

  const applyPreset = (values: ServerFields) => {
    for (const [k, v] of Object.entries(values) as [keyof ServerFields, ServerFields[keyof ServerFields]][]) {
      form.setValue(k, v, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    }
  };

  const onSubmit = form.handleSubmit(async (raw) => {
    const v = schema.parse(raw);
    await save.mutateAsync({
      id: account?.id,
      body: {
        email: v.email,
        // Blank on edit → the stored password is kept.
        ...(v.password.trim() ? { password: v.password } : {}),
        fromName: v.fromName ?? (account ? null : undefined),
        imapHost: v.imapHost,
        imapPort: v.imapPort,
        imapSecure: v.imapSecure,
        smtpHost: v.smtpHost,
        smtpPort: v.smtpPort,
        smtpSecure: v.smtpSecure,
        allowSelfSigned: v.allowSelfSigned,
        isActive: v.isActive,
        isDefault: v.isDefault,
        signatureHtml: v.signatureHtml ?? (account ? null : undefined),
      },
    });
    onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account ? `Hesap: ${account.email}` : 'Yeni e-posta hesabı'}</DialogTitle>
          <DialogDescription>Gelen e-postalar IMAP ile çekilir, gönderim SMTP ile yapılır. Şifre sunucuda şifrelenmiş saklanır.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Hazır ayar:</span>
            {PRESETS.map((p) => (
              <Button key={p.key} type="button" variant="outline" size="sm" onClick={() => applyPreset(p.values)}>
                {p.icon} {p.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-posta adresi" error={errors.email} htmlFor="email" required>
              <Input id="email" type="email" autoComplete="off" placeholder="info@maeyja.com" {...form.register('email')} />
            </Field>
            <Field label="Görünen ad" error={errors.fromName} htmlFor="fromName" hint="Alıcının gördüğü gönderen adı">
              <Input id="fromName" maxLength={120} placeholder="MAEYJA" {...form.register('fromName')} />
            </Field>
            <Field
              label="Şifre"
              error={errors.password}
              htmlFor="password"
              required={!account}
              className="sm:col-span-2"
              hint={account ? 'Boş bırakırsanız değişmez' : isGmail ? 'Gmail için uygulama şifresi (aşağıya bakın)' : 'Posta kutusunun şifresi'}
            >
              <Input id="password" type="password" autoComplete="new-password" maxLength={200} placeholder={account ? '••••••••' : undefined} {...form.register('password')} />
            </Field>
          </div>

          {isGmail && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Gmail normal hesap şifresini kabul etmez. Google hesabında iki adımlı doğrulamayı açın, <b>myaccount.google.com/apppasswords</b> adresinden 16 haneli bir uygulama şifresi oluşturup buraya girin.
              </span>
            </p>
          )}

          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-foreground/80">Gelen (IMAP)</legend>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label="Sunucu" error={errors.imapHost} htmlFor="imapHost" required>
                <Input id="imapHost" autoComplete="off" placeholder="imap.alan.com" {...form.register('imapHost')} />
              </Field>
              <Field label="Port" error={errors.imapPort} htmlFor="imapPort" required>
                <Input id="imapPort" type="number" min={1} max={65535} step={1} {...form.register('imapPort')} />
              </Field>
            </div>
            <Controller control={form.control} name="imapSecure" render={({ field }) => <SwitchField label="SSL/TLS" description="993 → açık · 143 → kapalı (STARTTLS)" checked={field.value} onCheckedChange={field.onChange} />} />
          </fieldset>

          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium text-foreground/80">Giden (SMTP)</legend>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label="Sunucu" error={errors.smtpHost} htmlFor="smtpHost" required>
                <Input id="smtpHost" autoComplete="off" placeholder="smtp.alan.com" {...form.register('smtpHost')} />
              </Field>
              <Field label="Port" error={errors.smtpPort} htmlFor="smtpPort" required>
                <Input id="smtpPort" type="number" min={1} max={65535} step={1} {...form.register('smtpPort')} />
              </Field>
            </div>
            <Controller control={form.control} name="smtpSecure" render={({ field }) => <SwitchField label="SSL/TLS" description="465 → açık · 587 → kapalı (STARTTLS)" checked={field.value} onCheckedChange={field.onChange} />} />
          </fieldset>

          <div className="grid gap-1.5">
            <Controller
              control={form.control}
              name="allowSelfSigned"
              render={({ field }) => (
                <SwitchField label="Kendinden imzalı sertifikayı kabul et" description="Kendi posta sunucumuz (127.0.0.1) için; sertifika doğrulaması atlanır." checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            {remoteSelfSigned && <p className="text-xs text-amber-800">Uzak bir sunucuda bu ayar bağlantıyı araya girmeye açık bırakır; yalnızca güvendiğiniz sunucularda açın.</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Controller control={form.control} name="isActive" render={({ field }) => <SwitchField label="Aktif" description="Pasif hesaptan e-posta çekilmez ve gönderilmez" checked={field.value} onCheckedChange={field.onChange} />} />
            <Controller
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <SwitchField
                  label="Varsayılan hesap"
                  description={account?.isDefault ? 'Değiştirmek için başka bir hesabı varsayılan yapın' : 'Yeni e-postalar bu hesaptan gider'}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={account?.isDefault}
                />
              )}
            />
          </div>

          <Field label="İmza" error={errors.signatureHtml} htmlFor="signatureHtml" hint="Bu hesaptan yazılan yeni e-postalara, yanıtlara ve iletmelere otomatik eklenir">
            <Controller control={form.control} name="signatureHtml" render={({ field }) => <RichText id="signatureHtml" value={field.value ?? ''} onChange={field.onChange} rows={5} placeholder="<p>MAEYJA<br>info@maeyja.com</p>" />} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={save.isPending}>{account ? 'Kaydet' : 'Hesabı ekle'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
