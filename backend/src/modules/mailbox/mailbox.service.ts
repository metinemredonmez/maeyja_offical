import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MailAccount, MailDirection, Prisma } from '@prisma/client';
import { ImapFlow } from 'imapflow';
import { AddressObject, simpleParser } from 'mailparser';
import * as nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { paginate, skipTake } from '../../common/dto/pagination.dto';
import { decrypt, encrypt, keyFromEnv } from '../../common/utils/crypto.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailAccountDto, MailQueryDto, SendMailDto, UpdateMailAccountDto } from './dto/mailbox.dto';
import { sanitizeMailHtml, snippetOf } from './mail-html';

type Address = { name: string | null; address: string };

/** First sync imports this many recent messages; after that only new UIDs are fetched. */
const INITIAL_SYNC = 100;
/** Per-run cap so one huge mailbox can't stall the job. */
const MAX_PER_RUN = 200;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

/** Columns for list views — never the bodies or attachment bytes. */
const SUMMARY = {
  id: true,
  accountId: true,
  direction: true,
  fromName: true,
  fromAddress: true,
  to: true,
  subject: true,
  snippet: true,
  isRead: true,
  hasAttachments: true,
  date: true,
  account: { select: { email: true } },
} satisfies Prisma.MailMessageSelect;

type SummaryRow = Prisma.MailMessageGetPayload<{ select: typeof SUMMARY }>;

const toAddresses = (v: AddressObject | AddressObject[] | undefined): Address[] =>
  (Array.isArray(v) ? v : v ? [v] : []).flatMap((o) => o.value).filter((a) => a.address).map((a) => ({ name: a.name || null, address: a.address!.toLowerCase() }));

/**
 * Admin webmail (ported from the fly project): IMAP accounts are polled into the database,
 * read and answered from the panel; replies go out through the account's own SMTP.
 */
@Injectable()
export class MailboxService {
  private readonly logger = new Logger(MailboxService.name);
  private readonly key: Buffer;
  private syncing = false;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.key = keyFromEnv(config.get('APP_ENCRYPTION_KEY', { infer: true }), config.get('JWT_ACCESS_SECRET', { infer: true }));
  }

  // ───────── accounts ─────────

  async accounts() {
    const [rows, unread] = await Promise.all([
      this.prisma.mailAccount.findMany({ orderBy: [{ isDefault: 'desc' }, { email: 'asc' }] }),
      this.prisma.mailMessage.groupBy({ by: ['accountId'], where: { direction: MailDirection.INBOUND, isRead: false, deletedAt: null }, _count: true }),
    ]);
    const counts = new Map(unread.map((u) => [u.accountId, u._count]));
    return rows.map((a) => this.publicAccount(a, counts.get(a.id) ?? 0));
  }

  async createAccount(dto: MailAccountDto) {
    if (await this.prisma.mailAccount.findUnique({ where: { email: dto.email } })) throw new BadRequestException('Bu adres zaten ekli');
    const { password, ...rest } = dto;
    const first = (await this.prisma.mailAccount.count()) === 0;
    const isDefault = first || !!dto.isDefault;
    const account = await this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.mailAccount.updateMany({ data: { isDefault: false } });
      return tx.mailAccount.create({ data: { ...rest, isDefault, passwordEnc: encrypt(password, this.key) } });
    });
    void this.syncAccount(account).catch(() => undefined);
    return this.publicAccount(account, 0);
  }

  async updateAccount(id: string, dto: UpdateMailAccountDto) {
    const current = await this.findAccount(id);
    const { password, ...rest } = dto;
    const account = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.mailAccount.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      return tx.mailAccount.update({
        where: { id },
        data: {
          ...rest,
          ...(password ? { passwordEnc: encrypt(password, this.key) } : {}),
          // A different server or login means a different INBOX: restart the incremental sync.
          ...((dto.imapHost && dto.imapHost !== current.imapHost) || (dto.email && dto.email !== current.email) ? { uidValidity: null, lastUid: 0 } : {}),
        },
      });
    });
    return this.publicAccount(account, 0);
  }

  async deleteAccount(id: string) {
    const account = await this.findAccount(id);
    await this.prisma.mailAccount.delete({ where: { id } });
    if (account.isDefault) {
      const next = await this.prisma.mailAccount.findFirst({ orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.mailAccount.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { ok: true };
  }

  /** Logs in to IMAP and verifies SMTP; stores the result on the account. */
  async testAccount(id: string) {
    const account = await this.findAccount(id);
    const result = { imap: { ok: false, error: undefined as string | undefined }, smtp: { ok: false, error: undefined as string | undefined } };
    const imap = this.imap(account);
    try {
      await imap.connect();
      result.imap.ok = true;
    } catch (e) {
      result.imap.error = this.reason(e);
    } finally {
      await imap.logout().catch(() => undefined);
    }
    try {
      await this.smtp(account).verify();
      result.smtp.ok = true;
    } catch (e) {
      result.smtp.error = this.reason(e);
    }
    const ok = result.imap.ok && result.smtp.ok;
    await this.prisma.mailAccount.update({
      where: { id },
      data: { lastTestAt: new Date(), lastTestOk: ok, lastError: ok ? null : [result.imap.error && `IMAP: ${result.imap.error}`, result.smtp.error && `SMTP: ${result.smtp.error}`].filter(Boolean).join(' · ') },
    });
    return result;
  }

  // ───────── messages ─────────

  async list(q: MailQueryDto) {
    const where: Prisma.MailMessageWhereInput = {
      deletedAt: null,
      direction: q.folder === 'SENT' ? MailDirection.OUTBOUND : MailDirection.INBOUND,
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.unread ? { isRead: false } : {}),
      ...(q.q
        ? {
            OR: [
              { subject: { contains: q.q, mode: 'insensitive' } },
              { fromAddress: { contains: q.q, mode: 'insensitive' } },
              { fromName: { contains: q.q, mode: 'insensitive' } },
              { snippet: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.mailMessage.findMany({ where, select: SUMMARY, orderBy: { date: 'desc' }, ...skipTake(q) }),
      this.prisma.mailMessage.count({ where }),
    ]);
    return paginate(rows.map((r) => this.summary(r)), total, q.page, q.limit);
  }

  /** Opening a message marks it read. */
  async get(id: string) {
    const m = await this.prisma.mailMessage.findFirst({
      where: { id, deletedAt: null },
      include: { account: { select: { email: true } }, attachments: { select: { index: true, filename: true, contentType: true, size: true }, orderBy: { index: 'asc' } } },
    });
    if (!m) throw new NotFoundException('E-posta bulunamadı');
    if (!m.isRead) await this.prisma.mailMessage.update({ where: { id }, data: { isRead: true } });
    return {
      ...this.summary({ ...m, isRead: true }),
      cc: (m.cc as Address[] | null) ?? [],
      replyTo: (m.replyTo as Address[] | null) ?? [],
      html: m.html,
      text: m.text,
      attachments: m.attachments,
      messageId: m.messageId,
      inReplyTo: m.inReplyTo,
      status: m.status as 'SENT' | 'FAILED' | null,
      error: m.error,
    };
  }

  async markRead(id: string, isRead: boolean) {
    await this.findMessage(id);
    const m = await this.prisma.mailMessage.update({ where: { id }, data: { isRead }, select: SUMMARY });
    return this.summary(m);
  }

  async remove(id: string) {
    await this.findMessage(id);
    await this.prisma.mailMessage.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async attachment(id: string, index: number) {
    await this.findMessage(id);
    const a = await this.prisma.mailAttachment.findUnique({ where: { messageId_index: { messageId: id, index } } });
    if (!a) throw new NotFoundException('Ek bulunamadı');
    return a;
  }

  unreadCount() {
    return this.prisma.mailMessage
      .count({ where: { direction: MailDirection.INBOUND, isRead: false, deletedAt: null, account: { isActive: true } } })
      .then((count) => ({ count }));
  }

  /** Sends through the account's SMTP, keeps a copy in the panel and in the server's Sent folder. */
  async send(dto: SendMailDto, userId: string) {
    const account = dto.accountId
      ? await this.findAccount(dto.accountId)
      : await this.prisma.mailAccount.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
    if (!account) throw new BadRequestException('Önce bir mail hesabı ekleyin');
    const original = dto.replyToId ? await this.prisma.mailMessage.findUnique({ where: { id: dto.replyToId } }) : null;
    const references = original ? [original.references, original.messageId].filter(Boolean).join(' ') || undefined : undefined;
    const html = dto.html;
    const mail = {
      from: { name: account.fromName ?? '', address: account.email },
      to: dto.to,
      cc: dto.cc?.length ? dto.cc : undefined,
      subject: dto.subject,
      html,
      text: snippetOf(null, html, 100_000),
      inReplyTo: original?.messageId ?? undefined,
      references,
    };

    let messageId: string | null = null;
    let error: string | null = null;
    try {
      const info = await this.smtp(account).sendMail(mail);
      messageId = info.messageId ?? null;
    } catch (e) {
      error = this.reason(e);
    }
    const saved = await this.prisma.mailMessage.create({
      data: {
        accountId: account.id,
        direction: MailDirection.OUTBOUND,
        messageId,
        inReplyTo: original?.messageId ?? null,
        references: references ?? null,
        fromName: account.fromName,
        fromAddress: account.email,
        to: dto.to.map((address) => ({ name: null, address })),
        cc: (dto.cc ?? []).map((address) => ({ name: null, address })),
        subject: dto.subject,
        html: sanitizeMailHtml(html),
        text: mail.text,
        snippet: snippetOf(null, html),
        isRead: true,
        status: error ? 'FAILED' : 'SENT',
        error,
        date: new Date(),
        sentById: userId,
      },
    });
    if (error) throw new BadRequestException(`Gönderilemedi: ${error}`);
    if (original && !original.isRead) await this.prisma.mailMessage.update({ where: { id: original.id }, data: { isRead: true } });
    void this.appendToSent(account, { ...mail, messageId: messageId ?? undefined }).catch((e) => this.logger.warn(`Sent klasörüne yazılamadı (${account.email}): ${this.reason(e)}`));
    return this.get(saved.id);
  }

  // ───────── sync ─────────

  /** Background poll; also triggered by "Yenile" in the panel. */
  @Cron('*/3 * * * *')
  async syncAll() {
    if (this.syncing) return { fetched: 0, errors: [] as { email: string; error: string }[] };
    this.syncing = true;
    const errors: { email: string; error: string }[] = [];
    let fetched = 0;
    try {
      for (const account of await this.prisma.mailAccount.findMany({ where: { isActive: true } })) {
        try {
          fetched += await this.syncAccount(account);
        } catch (e) {
          errors.push({ email: account.email, error: this.reason(e) });
        }
      }
    } finally {
      this.syncing = false;
    }
    return { fetched, errors };
  }

  private async syncAccount(account: MailAccount): Promise<number> {
    const client = this.imap(account);
    let imported = 0;
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const box = client.mailbox;
        if (!box) return 0;
        const validity = String(box.uidValidity);
        let since = account.uidValidity === validity ? account.lastUid : 0;
        let range: string | number[];
        if (since > 0) {
          range = `${since + 1}:*`;
        } else {
          const all = (await client.search({ all: true }, { uid: true })) || [];
          range = all.slice(-INITIAL_SYNC);
          if (!range.length) {
            await this.prisma.mailAccount.update({ where: { id: account.id }, data: { uidValidity: validity, lastFetchAt: new Date(), lastError: null } });
            return 0;
          }
        }
        for await (const msg of client.fetch(range, { uid: true, source: true, flags: true, internalDate: true }, { uid: true })) {
          if (msg.uid <= since || !msg.source) continue; // "N:*" always returns the newest message
          if (await this.importMessage(account.id, msg.uid, msg.source, msg.flags?.has('\\Seen') ?? false, msg.internalDate)) imported++;
          since = Math.max(since, msg.uid);
          if (imported >= MAX_PER_RUN) break;
        }
        await this.prisma.mailAccount.update({ where: { id: account.id }, data: { uidValidity: validity, lastUid: since, lastFetchAt: new Date(), lastError: null } });
      } finally {
        lock.release();
      }
    } catch (e) {
      await this.prisma.mailAccount.update({ where: { id: account.id }, data: { lastError: this.reason(e) } }).catch(() => undefined);
      throw e;
    } finally {
      await client.logout().catch(() => undefined);
    }
    if (imported) this.logger.log(`${account.email}: ${imported} yeni e-posta`);
    return imported;
  }

  /** Parses one raw message and stores it (with attachments); false when it was already imported. */
  private async importMessage(accountId: string, uid: number, source: Buffer, seen: boolean, internalDate?: Date | string) {
    const parsed = await simpleParser(source); // inline cid: images become data: URIs in the html
    const messageId = parsed.messageId ?? null;
    if (messageId && (await this.prisma.mailMessage.findUnique({ where: { accountId_messageId: { accountId, messageId } }, select: { id: true } }))) return false;
    if (!messageId && (await this.prisma.mailMessage.findFirst({ where: { accountId, uid, messageId: null }, select: { id: true } }))) return false;

    const from = toAddresses(parsed.from)[0] ?? { name: null, address: 'unknown' };
    const html = parsed.html ? sanitizeMailHtml(parsed.html) : null;
    let total = 0;
    const attachments = parsed.attachments
      .filter((a) => !a.related) // inline images are already embedded in the html
      .filter((a) => a.size <= MAX_ATTACHMENT_BYTES && (total += a.size) <= MAX_TOTAL_ATTACHMENT_BYTES)
      .map((a, index) => ({ index, filename: (a.filename || `ek-${index + 1}`).slice(0, 200), contentType: a.contentType || 'application/octet-stream', size: a.size, data: new Uint8Array(a.content) }));

    await this.prisma.mailMessage.create({
      data: {
        accountId,
        direction: MailDirection.INBOUND,
        uid,
        messageId,
        inReplyTo: parsed.inReplyTo ?? null,
        references: Array.isArray(parsed.references) ? parsed.references.join(' ') : (parsed.references ?? null),
        fromName: from.name,
        fromAddress: from.address,
        to: toAddresses(parsed.to),
        cc: toAddresses(parsed.cc),
        replyTo: toAddresses(parsed.replyTo),
        subject: parsed.subject?.slice(0, 500) ?? null,
        text: parsed.text ?? null,
        html,
        snippet: snippetOf(parsed.text, html),
        hasAttachments: attachments.length > 0,
        isRead: seen,
        date: parsed.date ?? (internalDate ? new Date(internalDate) : new Date()),
        attachments: attachments.length ? { create: attachments } : undefined,
      },
    });
    return true;
  }

  /** Best effort: keeps the reply visible in other mail clients (phone, webmail). */
  private async appendToSent(account: MailAccount, mail: Parameters<nodemailer.Transporter['sendMail']>[0]) {
    const raw = await new MailComposer(mail).compile().build();
    const client = this.imap(account);
    try {
      await client.connect();
      const folders = await client.list();
      const sent = folders.find((f) => f.specialUse === '\\Sent') ?? folders.find((f) => /^(inbox\.)?sent/i.test(f.path));
      if (sent) await client.append(sent.path, raw, ['\\Seen']);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  // ───────── helpers ─────────

  private imap(a: MailAccount) {
    return new ImapFlow({
      host: a.imapHost,
      port: a.imapPort,
      secure: a.imapSecure,
      auth: { user: a.email, pass: decrypt(a.passwordEnc, this.key) },
      tls: { rejectUnauthorized: !a.allowSelfSigned },
      logger: false,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: 60_000,
    });
  }

  private smtp(a: MailAccount) {
    return nodemailer.createTransport({
      host: a.smtpHost,
      port: a.smtpPort,
      secure: a.smtpSecure,
      auth: { user: a.email, pass: decrypt(a.passwordEnc, this.key) },
      tls: { rejectUnauthorized: !a.allowSelfSigned },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
    });
  }

  private summary(m: SummaryRow) {
    return {
      id: m.id,
      accountId: m.accountId,
      accountEmail: m.account.email,
      direction: m.direction,
      from: { name: m.fromName, address: m.fromAddress },
      to: (m.to as Address[]) ?? [],
      subject: m.subject,
      snippet: m.snippet,
      isRead: m.isRead,
      hasAttachments: m.hasAttachments,
      date: m.date,
    };
  }

  private publicAccount(a: MailAccount, unreadCount: number) {
    const { passwordEnc: _secret, uidValidity: _v, lastUid: _u, ...rest } = a;
    return { ...rest, unreadCount };
  }

  private async findAccount(id: string) {
    const a = await this.prisma.mailAccount.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Mail hesabı bulunamadı');
    return a;
  }

  private async findMessage(id: string) {
    const m = await this.prisma.mailMessage.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!m) throw new NotFoundException('E-posta bulunamadı');
    return m;
  }

  private reason(e: unknown) {
    const err = e as { responseText?: string; response?: string; message?: string; code?: string };
    return (err.responseText || err.response || err.message || err.code || 'Bilinmeyen hata').toString().slice(0, 300);
  }
}
