'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { InfoIcon, SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { Field, FormError, SimpleSelect, SubmitButton } from '@/components/shared/form';
import { RichText } from '@/components/shared/rich-text';
import { forwardQuote, prefixSubject, replyQuote, replyRecipients, signatureBlock, splitAddresses, stripSignatureMarkers, swapSignature } from '@/lib/mail';
import { useSendMail } from '@/lib/queries/mail';
import { composeSchema, type ComposeFormValues } from '@/lib/schemas/mail';
import type { MailAccount, MailMessage } from '@/lib/types';

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';
export type ComposeRequest = { mode: ComposeMode; original?: MailMessage };

const TITLES: Record<ComposeMode, string> = { new: 'Yeni e-posta', reply: 'Yanıtla', replyAll: 'Tümünü yanıtla', forward: 'İlet' };

/** Initial form values: sender account, recipients, prefixed subject, signature and the quoted original. */
function draftFor({ mode, original }: ComposeRequest, accounts: MailAccount[]): ComposeFormValues {
  const account = (original && accounts.find((a) => a.id === original.accountId)) ?? accounts.find((a) => a.isDefault) ?? accounts[0];
  const head = `<p></p>\n${signatureBlock(account?.signatureHtml)}`;
  const base = { accountId: account?.id ?? '', to: '', cc: '' };
  if (!original || mode === 'new') return { ...base, subject: '', html: head };
  if (mode === 'forward') return { ...base, subject: prefixSubject('Fw', original.subject), html: `${head}\n${forwardQuote(original)}` };
  const { to, cc } = replyRecipients(original, mode === 'replyAll', accounts.map((a) => a.email));
  return { ...base, to: to.join(', '), cc: cc.join(', '), subject: prefixSubject('Re', original.subject), html: `${head}\n${replyQuote(original)}` };
}

/** New mail, reply, reply-all and forward share this dialog. Mount it only while open. */
export function ComposeDialog({ request, accounts, onClose }: { request: ComposeRequest; accounts: MailAccount[]; onClose: () => void }) {
  const send = useSendMail();
  const confirm = useConfirm();
  const [defaults] = useState(() => draftFor(request, accounts));
  const form = useForm<ComposeFormValues>({ resolver: zodResolver(composeSchema), defaultValues: defaults });
  const errors = form.formState.errors;
  const { mode, original } = request;
  const lostAttachments = mode === 'forward' && (original?.attachments.length ?? 0) > 0;

  const close = () => {
    if (send.isPending) return;
    if (!form.formState.isDirty) return onClose();
    confirm.ask({ title: 'Taslak silinsin mi?', description: 'Yazdıklarınız kaydedilmez.', confirmLabel: 'Sil', destructive: true, onConfirm: onClose });
  };

  const onSubmit = form.handleSubmit(async (raw) => {
    const v = composeSchema.parse(raw);
    const cc = splitAddresses(v.cc);
    await send.mutateAsync({
      accountId: v.accountId,
      to: splitAddresses(v.to),
      cc: cc.length ? cc : undefined,
      subject: v.subject,
      html: stripSignatureMarkers(v.html),
      // Threads the reply (In-Reply-To / References); a forward starts a new thread.
      replyToId: original && (mode === 'reply' || mode === 'replyAll') ? original.id : undefined,
    });
    onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          <DialogDescription>{original ? (original.subject || '(konu yok)') : 'Seçtiğiniz hesabın SMTP sunucusundan gönderilir; kopyası “Gönderilen”de kalır.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={send.error} />
          <Field label="Gönderen hesap" error={errors.accountId} htmlFor="accountId" required>
            <Controller
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <SimpleSelect
                  id="accountId"
                  value={field.value}
                  onChange={(id) => {
                    field.onChange(id);
                    const account = accounts.find((a) => a.id === id);
                    form.setValue('html', swapSignature(form.getValues('html'), signatureBlock(account?.signatureHtml)), { shouldDirty: true });
                  }}
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: a.fromName ? (
                      <span className="truncate">
                        {a.fromName} <span className="text-muted-foreground">&lt;{a.email}&gt;</span>
                      </span>
                    ) : (
                      a.email
                    ),
                  }))}
                />
              )}
            />
          </Field>
          <Field label="Kime" error={errors.to} htmlFor="to" required hint="Birden fazla adresi virgül veya boşlukla ayırın">
            <Input id="to" autoComplete="off" placeholder="ornek@alan.com, diger@alan.com" {...form.register('to')} />
          </Field>
          <Field label="Bilgi" error={errors.cc} htmlFor="cc">
            <Input id="cc" autoComplete="off" {...form.register('cc')} />
          </Field>
          <Field label="Konu" error={errors.subject} htmlFor="subject" required>
            <Input id="subject" maxLength={300} {...form.register('subject')} />
          </Field>
          <Field label="İleti" error={errors.html} htmlFor="html" required hint="İmza seçili hesaptan gelir; hesabı değiştirirseniz imza da değişir.">
            <Controller control={form.control} name="html" render={({ field }) => <RichText id="html" value={field.value} onChange={field.onChange} rows={16} placeholder="<p>Merhaba,</p>" />} />
          </Field>
          {lostAttachments && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              Orijinal e-postadaki ekler iletilmez; gerekirse indirip ayrıca gönderin.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={send.isPending}>
              Vazgeç
            </Button>
            <SubmitButton loading={send.isPending}>
              {!send.isPending && <SendIcon />} Gönder
            </SubmitButton>
          </DialogFooter>
        </form>
        {confirm.dialog}
      </DialogContent>
    </Dialog>
  );
}
