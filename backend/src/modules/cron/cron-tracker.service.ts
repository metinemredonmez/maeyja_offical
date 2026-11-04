import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { maskEmails } from '../alerts/alert-catalog';
import { AlertsService } from '../alerts/alerts.service';
import { JOBS, JobRunner, setJobRunner, Tracked } from './tracked.decorator';

const HISTORY_DAYS = 30;

/** What a run returned, kept small and free of personal data: top-level numbers, flags, short texts, list lengths. */
export function summarize(value: unknown): Record<string, number | boolean | string> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return { value };
  if (typeof value === 'string') return { value: value.slice(0, 120) };
  if (Array.isArray(value)) return { items: value.length };
  if (typeof value !== 'object') return null;
  const out: Record<string, number | boolean | string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 10)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 120);
    else if (Array.isArray(v)) out[k] = v.length;
  }
  return Object.keys(out).length ? out : null;
}

const didWork = (s: Record<string, unknown> | null) => !!s && Object.values(s).some((v) => (typeof v === 'number' ? v > 0 : v === true));

/**
 * Minutes a job is overdue, or 0. Counted from the run in progress if there is one (a stuck job), else from its last
 * start — but never from before this process started, so a deploy doesn't make every job look late.
 */
export function minutesLate(everyMin: number, lastStartedAt: Date | null, runningSince: Date | null, bootAt: Date, now = Date.now()): number {
  const since = runningSince ?? new Date(Math.max(lastStartedAt?.getTime() ?? 0, bootAt.getTime()));
  const late = (now - since.getTime()) / 60_000 - (everyMin * 2 + 10);
  return late > 0 ? Math.round(late) : 0;
}

/**
 * Keeps the last state of every scheduled job and a history of its runs (admin → Zamanlanmış işler), raises an alert
 * when one fails or stops running, and lets an admin start one by hand. Single pm2 instance: what runs now is known
 * in memory.
 */
@Injectable()
export class CronTrackerService implements JobRunner, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronTrackerService.name);
  private readonly running = new Map<string, Date>();
  private readonly streaks = new Map<string, number>();
  private manual: { name: string; actorId: string } | null = null;
  private readonly bootAt = new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    setJobRunner(this);
    try {
      for (const j of await this.prisma.cronJob.findMany({ select: { name: true, failStreak: true } })) this.streaks.set(j.name, j.failStreak);
    } catch (e) {
      this.logger.warn(`job states not loaded: ${(e as Error).message}`);
    }
  }

  onModuleDestroy() {
    setJobRunner(null);
  }

  async run<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    const manual = this.manual?.name === name ? this.manual : null;
    if (manual) this.manual = null;
    // Called again while it runs (the panel's "Yenile" during the 3-minute mail sync): the job's own guard decides.
    if (this.running.has(name)) return fn();
    const startedAt = new Date();
    this.running.set(name, startedAt);
    try {
      const result = await fn();
      await this.record(name, startedAt, 'ok', { result, actorId: manual?.actorId });
      return result;
    } catch (e) {
      await this.record(name, startedAt, 'error', { error: e, actorId: manual?.actorId });
      throw e;
    } finally {
      this.running.delete(name);
    }
  }

  /** Admin → "Şimdi çalıştır": starts the job in the background; its run is recorded as manual. */
  trigger(name: string, actorId: string) {
    const job = JOBS.get(name);
    if (!job) throw new NotFoundException('Böyle bir iş yok');
    if (this.running.has(name)) throw new ConflictException('Bu iş şu anda çalışıyor');
    const instance = this.moduleRef.get(job.target as Type, { strict: false }) as Record<string, () => unknown>;
    // run() reads this synchronously as the job starts.
    this.manual = { name, actorId };
    void Promise.resolve(instance[job.method]()).catch(() => undefined); // recorded and alerted by run()
    return { started: true };
  }

  async list() {
    const rows = new Map((await this.prisma.cronJob.findMany()).map((r) => [r.name, r]));
    return [...JOBS.values()]
      .sort((a, b) => a.everyMin - b.everyMin || a.label.localeCompare(b.label, 'tr'))
      .map((j) => {
        const r = rows.get(j.name);
        const running = this.running.get(j.name) ?? null;
        return {
          name: j.name,
          label: j.label,
          everyMin: j.everyMin,
          running,
          lastStartedAt: r?.lastStartedAt ?? null,
          lastFinishedAt: r?.lastFinishedAt ?? null,
          lastDurationMs: r?.lastDurationMs ?? null,
          lastStatus: r?.lastStatus ?? null,
          lastError: r?.lastError ?? null,
          lastOkAt: r?.lastOkAt ?? null,
          failStreak: r?.failStreak ?? 0,
          runs: r?.runs ?? 0,
          lateMin: minutesLate(j.everyMin, r?.lastStartedAt ?? null, running, this.bootAt),
        };
      });
  }

  /** LOG-04: a job that stopped running (or hangs) is as bad as one that fails. Also drops old history. */
  @Cron(CronExpression.EVERY_HOUR)
  @Tracked('cron.watch', { label: 'Geciken iş kontrolü', everyMin: 60 })
  async watch() {
    let late = 0;
    for (const j of await this.list()) {
      if (j.lateMin) {
        late++;
        const last = j.lastStartedAt ? j.lastStartedAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'hiç';
        const why = j.running ? `${Math.round((Date.now() - j.running.getTime()) / 60_000)} dakikadır sürüyor, bitmedi` : `beklenen sürede çalışmadı (son çalışma: ${last})`;
        void this.alerts.raise('cron.late', `${j.label}: ${why}.`, { key: j.name });
      } else {
        void this.alerts.clear('cron.late', j.name);
      }
    }
    const { count } = await this.prisma.cronRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - HISTORY_DAYS * 86400_000) } } });
    return { late, oldRunsDeleted: count };
  }

  private async record(name: string, startedAt: Date, status: 'ok' | 'error', r: { result?: unknown; error?: unknown; actorId?: string }) {
    const job = JOBS.get(name);
    const now = new Date();
    const durationMs = now.getTime() - startedAt.getTime();
    const error = status === 'error' ? maskEmails(r.error instanceof Error ? r.error.message : String(r.error)).slice(0, 1000) : null;
    const summary = summarize(r.result);
    const previous = this.streaks.get(name) ?? 0;
    const streak = status === 'ok' ? 0 : previous + 1;
    this.streaks.set(name, streak);
    try {
      const state = { lastStartedAt: startedAt, lastFinishedAt: now, lastDurationMs: durationMs, lastStatus: status, lastError: error, failStreak: streak };
      await this.prisma.cronJob.upsert({
        where: { name },
        create: { name, ...state, lastOkAt: status === 'ok' ? now : null, runs: 1 },
        update: { ...state, ...(status === 'ok' ? { lastOkAt: now } : {}), runs: { increment: 1 } },
      });
      // Every run of a minute job would bury the history: keep failures, manual runs, real work and the slow jobs.
      if (status === 'error' || r.actorId || (job?.everyMin ?? 0) >= 60 || didWork(summary)) {
        await this.prisma.cronRun.create({
          data: { name, trigger: r.actorId ? 'manual' : 'schedule', actorId: r.actorId ?? null, startedAt, durationMs, status, result: (summary ?? undefined) as Prisma.InputJsonValue | undefined, error },
        });
      }
    } catch (e) {
      this.logger.warn(`run of ${name} not recorded: ${(e as Error).message}`);
    }
    // A frequent job gets a few tries first: one passing database hiccup isn't worth an e-mail.
    if (status === 'error' && streak >= ((job?.everyMin ?? 60) <= 5 ? 3 : 1)) {
      void this.alerts.raise('cron.failed', `${job?.label ?? name}${streak > 1 ? `, üst üste ${streak} kez` : ''}: ${error}`, { key: name });
    }
    if (status === 'ok' && previous > 0) void this.alerts.clear('cron.failed', name);
  }
}
