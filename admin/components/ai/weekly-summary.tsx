'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2Icon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/shared/primitives';
import { api, errorMessage } from '@/lib/api.client';
import { formatDateTime } from '@/lib/format';

type Weekly = { summary: string; todo: string[]; at: string };

/** "Bu hafta": the last seven days against the seven before, in plain Turkish, with a short to-do list (Claude). */
export function WeeklySummary() {
  const [asked, setAsked] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const q = useQuery({
    queryKey: ['ai-weekly', refresh],
    queryFn: () => api.get<Weekly>(`/admin/ai/weekly${refresh ? '?refresh=1' : ''}`),
    enabled: asked,
    staleTime: 30 * 60_000,
  });
  return (
    <Section
      title={
        <span className="flex items-center gap-1.5">
          <SparklesIcon className="size-4" /> Bu hafta
        </span>
      }
      description="Son yedi gün, önceki yedi günle karşılaştırmalı; yapay zekâ düz cümlelerle özetler."
      actions={
        asked && q.data ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setRefresh((n) => n + 1)} disabled={q.isFetching}>
            <RefreshCwIcon /> Yenile
          </Button>
        ) : null
      }
    >
      {!asked ? (
        <Button type="button" size="sm" onClick={() => setAsked(true)}>
          <SparklesIcon /> Haftalık özeti hazırla
        </Button>
      ) : q.isFetching && !q.data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Hazırlanıyor…
        </p>
      ) : q.error ? (
        <p className="text-sm text-rose-700">{errorMessage(q.error)}</p>
      ) : q.data ? (
        <div className="grid gap-3 text-sm">
          <p className="leading-relaxed">{q.data.summary}</p>
          {q.data.todo.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {q.data.todo.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{formatDateTime(q.data.at)}</p>
        </div>
      ) : null}
    </Section>
  );
}
