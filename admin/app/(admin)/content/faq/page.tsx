'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { Field, FormError, SubmitButton, SwitchField } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, QueryState } from '@/components/shared/query-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { TranslationsTabs } from '@/components/shared/translations-tabs';
import { cleanTranslations } from '@/lib/i18n';
import { stripHtml } from '@/lib/html';
import { useDeleteFaq, useFaq, useSaveFaq } from '@/lib/queries/content';
import { faqSchema, type FaqFormValues } from '@/lib/schemas/content';
import type { Faq } from '@/lib/types';

function FaqDialog({ item, groups, onClose }: { item: Faq | null; groups: string[]; onClose: () => void }) {
  const save = useSaveFaq();
  const form = useForm<FaqFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      group: item?.group ?? '',
      question: item?.question ?? '',
      answer: item?.answer ?? '',
      sortOrder: item?.sortOrder != null ? String(item.sortOrder) : '',
      isActive: item?.isActive ?? true,
      translations: (item?.translations as Record<string, Record<string, string>>) ?? {},
    },
  });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = faqSchema.parse(raw);
    await save.mutateAsync({ id: item?.id, body: { group: v.group ?? (item ? null : undefined), question: v.question, answer: v.answer, sortOrder: v.sortOrder, isActive: v.isActive, translations: cleanTranslations(v.translations) ?? {} } });
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Soruyu düzenle' : 'Yeni soru'}</DialogTitle>
          <DialogDescription>Sorular gruplara göre (Sipariş, Kargo, Bakım…) listelenir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <TranslationsTabs kind="FAQ entry"
            form={form}
            fields={[
              { name: 'question', label: 'Soru', required: true, maxLength: 300 },
              { name: 'answer', label: 'Cevap', type: 'rich', required: true, rows: 6 },
            ]}
            extraBase={
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Grup" error={form.formState.errors.group} htmlFor="group" hint="Örn. Sipariş, Kargo, Bakım">
                  <Input id="group" maxLength={60} list="faq-groups" {...form.register('group')} />
                  <datalist id="faq-groups">
                    {groups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Sıra" error={form.formState.errors.sortOrder} htmlFor="sortOrder">
                  <Input id="sortOrder" type="number" step={1} {...form.register('sortOrder')} />
                </Field>
                <Controller control={form.control} name="isActive" render={({ field }) => <SwitchField label="Yayında" checked={field.value} onCheckedChange={field.onChange} className="self-end" />} />
              </div>
            }
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={save.isPending}>Kaydet</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FaqPage() {
  const query = useFaq();
  const del = useDeleteFaq();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Faq | null | undefined>(undefined);
  const groups = Array.from(new Set((query.data ?? []).map((f) => f.group).filter((g): g is string => Boolean(g))));

  return (
    <>
      <PageHeader
        title="Sık sorulan sorular"
        description={query.data ? `${query.data.length} soru · ${groups.length} grup` : undefined}
        actions={
          <Button onClick={() => setEditing(null)}>
            <PlusIcon /> Yeni soru
          </Button>
        }
      />
      <QueryState query={query}>
        {(items) => {
          if (items.length === 0) return <EmptyState title="Soru yok" description="İlk soruyu ekleyin." />;
          const grouped = new Map<string, Faq[]>();
          for (const f of items) {
            const k = f.group ?? 'Diğer';
            grouped.set(k, [...(grouped.get(k) ?? []), f]);
          }
          return (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([group, list]) => (
                <section key={group}>
                  <h2 className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{group}</h2>
                  <ul className="divide-y rounded-xl border bg-card">
                    {list.map((f) => (
                      <li key={f.id} className="flex items-start gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {f.question} <StatusBadge kind="active" value={f.isActive} />
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{stripHtml(f.answer)}</p>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(f)} aria-label="Düzenle">
                          <PencilIcon />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-[#A3121B]" aria-label="Sil" onClick={() => confirm.ask({ title: 'Soru silinsin mi?', description: f.question, confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(f.id) })}>
                          <Trash2Icon />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          );
        }}
      </QueryState>
      {editing !== undefined && <FaqDialog item={editing} groups={groups} onClose={() => setEditing(undefined)} />}
      {confirm.dialog}
    </>
  );
}
