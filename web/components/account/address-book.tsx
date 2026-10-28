'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api.client';
import type { Address } from '@/lib/types';
import { Field } from '@/components/contact-form';

export function AddressBook({ initial }: { initial: Address[] }) {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const tco = useTranslations('checkout');
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => setAddresses(await api.get<Address[]>('/me/addresses'));
  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      setEditing(null);
      toast.success(t('saved'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    const payload = { ...body, isDefault: body.isDefault === 'on' };
    wrap(() => (editing === 'new' ? api.post('/me/addresses', payload) : api.patch(`/me/addresses/${(editing as Address).id}`, payload)));
  };

  return (
    <div className="flex flex-col gap-8">
      {addresses.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 border border-line p-5 text-sm">
              <span className="label text-muted">{a.title ?? `${a.firstName} ${a.lastName}`} {a.isDefault ? `· ${t('default')}` : ''}</span>
              <span>{a.firstName} {a.lastName}<br />{a.line1} {a.line2}<br />{a.district} / {a.city} {a.postalCode}<br />{a.phone}</span>
              <span className="label mt-auto flex gap-4 text-muted">
                <button type="button" onClick={() => setEditing(a)} className="hover:text-ink">{tc('edit')}</button>
                {!a.isDefault ? <button type="button" onClick={() => wrap(() => api.patch(`/me/addresses/${a.id}`, { isDefault: true }))} className="hover:text-ink">{t('makeDefault')}</button> : null}
                <button type="button" onClick={() => wrap(() => api.delete(`/me/addresses/${a.id}`))} className="hover:text-brand">{tc('delete')}</button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">{t('noAddresses')}</p>
      )}

      {editing ? (
        <form onSubmit={submit} className="grid gap-4 border border-line p-6 sm:grid-cols-2">
          {(() => {
            const a = editing === 'new' ? null : editing;
            return (
              <>
                <div className="sm:col-span-2"><Field label={t('addressTitle')} name="title" defaultValue={a?.title ?? ''} maxLength={40} /></div>
                <Field label={tc('firstName')} name="firstName" defaultValue={a?.firstName} required maxLength={60} />
                <Field label={tc('lastName')} name="lastName" defaultValue={a?.lastName} required maxLength={60} />
                <Field label={tc('phone')} name="phone" type="tel" defaultValue={a?.phone} required />
                <Field label={tco('country')} name="country" defaultValue={a?.country ?? 'TR'} maxLength={2} />
                <Field label={tco('city')} name="city" defaultValue={a?.city} required maxLength={60} />
                <Field label={tco('district')} name="district" defaultValue={a?.district} required maxLength={60} />
                <div className="sm:col-span-2"><Field label={tco('line1')} name="line1" defaultValue={a?.line1} required minLength={5} maxLength={200} /></div>
                <Field label={tco('line2')} name="line2" defaultValue={a?.line2 ?? ''} maxLength={200} />
                <Field label={tco('postalCode')} name="postalCode" defaultValue={a?.postalCode ?? ''} maxLength={12} />
                <label className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" name="isDefault" defaultChecked={a?.isDefault} className="accent-ink" />{t('default')}</label>
              </>
            );
          })()}
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary">{tc('save')}</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">{tc('cancel')}</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className="btn-outline self-start">{t('addAddress')}</button>
      )}
    </div>
  );
}
