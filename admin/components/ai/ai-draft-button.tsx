'use client';

import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api.client';

/**
 * "AI ile yaz" for a form without language tabs (e.g. an e-mail campaign): from what is written (at least `start`),
 * Claude drafts the empty fields among `fields`. Nothing is saved until the form is.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function AiDraftButton({ form, kind, fields, rich = [], start, startLabel, language }: { form: UseFormReturn<any>; kind: string; fields: string[]; rich?: string[]; start: string; startLabel: string; language?: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const values = form.getValues() as Record<string, unknown>;
    const text = (k: string) => (typeof values[k] === 'string' ? (values[k] as string) : '');
    if (!text(start).trim()) {
      toast.error(`Önce “${startLabel}” alanına ne anlatmak istediğinizi kısaca yazın`);
      return;
    }
    const want = fields.filter((k) => !text(k).replace(/<[^>]*>/g, '').trim());
    if (!want.length) {
      toast.success('Boş alan yok — doldurulacak bir şey kalmadı');
      return;
    }
    const given: Record<string, string> = Object.fromEntries(fields.map((k) => [k, text(k)]).filter(([, v]) => v.trim()));
    if (language) given.language = language;
    setBusy(true);
    try {
      const res = await api.post<{ fields: Record<string, string> }>('/admin/ai/draft', { kind, given, want, rich: rich.filter((r) => want.includes(r)) });
      for (const [k, v] of Object.entries(res.fields)) form.setValue(k, v, { shouldDirty: true });
      toast.success(`${Object.keys(res.fields).length} alan dolduruldu — kaydetmeden önce göz atın`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" size="sm" onClick={run} disabled={busy}>
      <SparklesIcon className="size-3.5" />
      {busy ? 'Yazılıyor…' : 'AI ile yaz'}
    </Button>
  );
}
