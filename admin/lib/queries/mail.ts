'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { MailAccount, MailFolder, MailMessage, MailMessageSummary, MailSyncResult, MailTestResult, Paginated } from '@/lib/types';

export type MailListParams = { folder: MailFolder; accountId?: string; q?: string; unread?: boolean; page: number; limit: number };

// The detail key sits outside `['mail', 'messages']` on purpose: refetching an open message
// marks it read server-side, so list invalidations must never touch it.
export const mailKeys = {
  accounts: ['mail', 'accounts'] as const,
  messages: ['mail', 'messages'] as const,
  messageList: (p: MailListParams) => ['mail', 'messages', p] as const,
  message: (id: string) => ['mail', 'message', id] as const,
  unread: ['mail', 'unread-count'] as const,
};

type MessagePage = Paginated<MailMessageSummary>;

// ───────────── accounts ─────────────
export type MailAccountInput = {
  email: string;
  password?: string;
  fromName?: string | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  allowSelfSigned: boolean;
  isActive?: boolean;
  isDefault?: boolean;
  signatureHtml?: string | null;
};

export const useMailAccounts = () => useQuery({ queryKey: mailKeys.accounts, queryFn: () => api.get<MailAccount[]>('/admin/mail/accounts') });

export const useSaveMailAccount = () =>
  useApiMutation<MailAccount, { id?: string; body: Partial<MailAccountInput> }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/mail/accounts/${id}`, body) : api.post('/admin/mail/accounts', body)),
    invalidate: [mailKeys.accounts],
    success: (_, { id }) => (id ? 'Hesap kaydedildi' : 'Hesap eklendi'),
  });

export const useSetDefaultMailAccount = () =>
  useApiMutation<MailAccount, string>({ mutationFn: (id) => api.patch(`/admin/mail/accounts/${id}`, { isDefault: true }), invalidate: [mailKeys.accounts], success: 'Varsayılan hesap güncellendi' });

export const useDeleteMailAccount = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/mail/accounts/${id}`), invalidate: [mailKeys.accounts, mailKeys.messages, mailKeys.unread], success: 'Hesap silindi' });

/** Result toast is shown by the caller (it lists IMAP and SMTP separately). */
export const useTestMailAccount = () =>
  useApiMutation<MailTestResult, string>({ mutationFn: (id) => api.post(`/admin/mail/accounts/${id}/test`), invalidate: [mailKeys.accounts], success: false });

// ───────────── messages ─────────────
export const useMailMessages = (params: MailListParams) =>
  useQuery({
    queryKey: mailKeys.messageList(params),
    queryFn: () => api.get<MessagePage>(`/admin/mail/messages${qs({ ...params, unread: params.unread || undefined })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

/** Opening a message marks it read server-side; mirror that into cached lists and refresh the counters. */
export function useMailMessage(id: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: mailKeys.message(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const m = await api.get<MailMessage>(`/admin/mail/messages/${id}`);
      const cached = qc
        .getQueriesData<MessagePage>({ queryKey: mailKeys.messages })
        .flatMap(([, page]) => page?.items ?? [])
        .filter((x) => x.id === m.id);
      // Not in any cached list (deep link) → we can't tell, so refresh the counters anyway.
      if (cached.length === 0 || cached.some((x) => !x.isRead)) {
        qc.setQueriesData<MessagePage>({ queryKey: mailKeys.messages }, (page) => page && { ...page, items: page.items.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)) });
        void qc.invalidateQueries({ queryKey: mailKeys.unread });
        void qc.invalidateQueries({ queryKey: mailKeys.accounts });
      }
      return m;
    },
  });
}

export function useMarkMailMessage() {
  const qc = useQueryClient();
  return useApiMutation<MailMessageSummary, { id: string; isRead: boolean }>({
    mutationFn: ({ id, isRead }) => api.patch(`/admin/mail/messages/${id}`, { isRead }),
    invalidate: [mailKeys.messages, mailKeys.unread, mailKeys.accounts],
    success: (_, { isRead }) => (isRead ? 'Okundu olarak işaretlendi' : 'Okunmadı olarak işaretlendi'),
    onSuccess: (_, { id, isRead }) => {
      qc.setQueryData<MailMessage>(mailKeys.message(id), (m) => m && { ...m, isRead });
      // Stale but not refetched now (that would mark it read again); the next open goes to the server.
      if (!isRead) void qc.invalidateQueries({ queryKey: mailKeys.message(id), refetchType: 'none' });
    },
  });
}

export const useDeleteMailMessage = () =>
  useApiMutation<{ ok: true }, string>({
    mutationFn: (id) => api.delete(`/admin/mail/messages/${id}`),
    invalidate: [mailKeys.messages, mailKeys.unread, mailKeys.accounts],
    success: 'E-posta panelden silindi',
  });

export type SendMailInput = { accountId?: string; to: string[]; cc?: string[]; subject: string; html: string; replyToId?: string };

export function useSendMail() {
  const qc = useQueryClient();
  return useApiMutation<MailMessage, SendMailInput>({
    mutationFn: (body) => api.post('/admin/mail/send', body),
    invalidate: [mailKeys.messages, mailKeys.unread, mailKeys.accounts],
    success: 'E-posta gönderildi',
    // A failed send still leaves a FAILED copy under "Gönderilen".
    onError: () => void qc.invalidateQueries({ queryKey: mailKeys.messages }),
  });
}

export const useSyncMail = () =>
  useApiMutation<MailSyncResult, void>({
    mutationFn: () => api.post('/admin/mail/sync'),
    invalidate: [mailKeys.messages, mailKeys.unread, mailKeys.accounts],
    success: false,
    onSuccess: (r) => {
      if (r.fetched > 0) toast.success(`${r.fetched} yeni e-posta alındı`);
      else if (r.errors.length === 0) toast.success('Yeni e-posta yok');
      if (r.errors.length > 0) toast.error(r.errors.length === 1 ? 'Bir hesap okunamadı' : `${r.errors.length} hesap okunamadı`, { description: r.errors.map((e) => `${e.email}: ${e.error}`).join('\n') });
    },
  });

export const useMailUnreadCount = () => useQuery({ queryKey: mailKeys.unread, queryFn: () => api.get<{ count: number }>('/admin/mail/unread-count'), refetchInterval: 60_000 });
