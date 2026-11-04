import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { readdir, readFile, stat, statfs } from 'fs/promises';
import { join, resolve } from 'path';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { CronTrackerService } from '../cron/cron-tracker.service';
import { Tracked } from '../cron/tracked.decorator';

const GB = 1024 ** 3;
/**
 * Shared server: warn early, and sound the alarm before Postgres stops for want of space. A share of the disk, kept
 * between a floor and a ceiling so a small disk isn't run to the end and a big one doesn't cry wolf.
 */
export const DISK = { lowPct: 15, lowMin: 5 * GB, lowMax: 20 * GB, fullPct: 5, fullMin: 1.5 * GB, fullMax: 5 * GB };
const BACKUP_MAX_AGE_H = 30;
const DEFAULT_BACKUP_STATUS = '/var/lib/maeyja/backup-status.json';
const UPLOADS_TTL_MS = 3600_000;
const READY_TTL_MS = 30_000;

/** ok · warn (someone should look) · fail (the shop can't work) · off (not checked here). */
export type Level = 'ok' | 'warn' | 'fail' | 'off';
export type BackupState = { configured: boolean; finishedAt: Date | null; ok: boolean | null; bytes: number | null; problem: string | null };

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function diskLevel(free: number, total: number): Level {
  if (free < clamp((total * DISK.fullPct) / 100, DISK.fullMin, DISK.fullMax)) return 'fail';
  if (free < clamp((total * DISK.lowPct) / 100, DISK.lowMin, DISK.lowMax)) return 'warn';
  return 'ok';
}

export function backupLevel(b: BackupState, now = Date.now()): Level {
  if (!b.configured) return 'off';
  if (!b.finishedAt || b.ok === false) return 'warn';
  return now - b.finishedAt.getTime() > BACKUP_MAX_AGE_H * 3600_000 ? 'warn' : 'ok';
}

/** The status line deploy/backup.sh writes: {"finishedAt":"…","ok":true,"bytes":123}. */
export function parseBackupStatus(text: string): Omit<BackupState, 'configured'> {
  try {
    const v = JSON.parse(text) as { finishedAt?: unknown; ok?: unknown; bytes?: unknown };
    const at = typeof v.finishedAt === 'string' ? new Date(v.finishedAt) : null;
    if (!at || Number.isNaN(at.getTime()) || typeof v.ok !== 'boolean') return { finishedAt: null, ok: null, bytes: null, problem: 'Yedek durum dosyası okunamadı' };
    return { finishedAt: at, ok: v.ok, bytes: typeof v.bytes === 'number' ? v.bytes : null, problem: null };
  } catch {
    return { finishedAt: null, ok: null, bytes: null, problem: 'Yedek durum dosyası okunamadı' };
  }
}

const gb = (bytes: number) => (bytes / GB).toFixed(1);

/** Bytes and files under a folder, walked without recursion; stops at `limit` files. */
async function folderSize(root: string, limit = 200_000) {
  let bytes = 0;
  let files = 0;
  const stack = [root];
  while (stack.length && files < limit) {
    const dir = stack.pop()!;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const path = join(dir, e.name);
      if (e.isDirectory()) stack.push(path);
      else if (e.isFile()) {
        bytes += await stat(path).then((s) => s.size, () => 0);
        files++;
      }
    }
  }
  return { bytes, files };
}

/**
 * The server around the API (LOG-04, OPS): free disk, the size of the uploads and of the database, and whether last
 * night's backup ran. Checked every 15 minutes with alerts; the numbers are for admins, and `/health/ready` gives
 * uptime monitors flags only.
 */
@Injectable()
export class InfraService {
  private readonly logger = new Logger(InfraService.name);
  private readonly root: string;
  private readonly backupFile: string;
  private uploads: { at: number; bytes: number; files: number } | null = null;
  private ready: { at: number; body: { status: 'ok' | 'degraded' | 'down'; checks: Record<string, Level> } } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly tracker: CronTrackerService,
    config: ConfigService<Env, true>,
  ) {
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.backupFile = config.get('BACKUP_STATUS_FILE', { infer: true }) || (config.get('NODE_ENV', { infer: true }) === 'production' ? DEFAULT_BACKUP_STATUS : '');
  }

  async disk() {
    const s = await statfs(this.root);
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    return { total, free, level: diskLevel(free, total) };
  }

  async uploadsSize() {
    if (!this.uploads || Date.now() - this.uploads.at > UPLOADS_TTL_MS) this.uploads = { at: Date.now(), ...(await folderSize(this.root)) };
    return { bytes: this.uploads.bytes, files: this.uploads.files };
  }

  async databaseBytes() {
    const [row] = await this.prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
    return Number(row.size);
  }

  async backup(): Promise<BackupState> {
    if (!this.backupFile) return { configured: false, finishedAt: null, ok: null, bytes: null, problem: null };
    const text = await readFile(this.backupFile, 'utf8').catch(() => null);
    if (text === null) return { configured: true, finishedAt: null, ok: null, bytes: null, problem: 'Yedek durum dosyası yok; sunucudaki yedek betiği güncel olmayabilir' };
    return { configured: true, ...parseBackupStatus(text) };
  }

  /** Admin → Zamanlanmış işler → Sunucu. */
  async status() {
    const [disk, uploads, databaseBytes, backup, jobs] = await Promise.all([this.disk(), this.uploadsSize(), this.databaseBytes(), this.backup(), this.tracker.list()]);
    return {
      disk,
      uploads,
      databaseBytes,
      backup: { ...backup, level: backupLevel(backup) },
      lateJobs: jobs.filter((j) => j.lateMin).map((j) => j.label),
      uptimeSec: Math.round(process.uptime()),
    };
  }

  /**
   * Public, for uptime monitors: flags only, no numbers. 503 ("down") only when the shop can't work — the database
   * is unreachable or the disk is full; a stale backup or a late job is "degraded". Cached for 30 seconds.
   */
  async readiness() {
    if (this.ready && Date.now() - this.ready.at < READY_TTL_MS) return this.ready.body;
    const checks: Record<string, Level> = { db: 'ok', disk: 'ok', backup: 'off', jobs: 'ok' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.jobs = (await this.tracker.list()).some((j) => j.lateMin) ? 'warn' : 'ok';
    } catch {
      checks.db = 'fail';
      checks.jobs = 'off';
    }
    checks.disk = await this.disk().then((d) => d.level, () => 'warn' as const);
    checks.backup = backupLevel(await this.backup());
    const levels = Object.values(checks);
    const body = { status: levels.includes('fail') ? ('down' as const) : levels.includes('warn') ? ('degraded' as const) : ('ok' as const), checks };
    this.ready = { at: Date.now(), body };
    return body;
  }

  @Cron('*/15 * * * *')
  @Tracked('infra.watch', { label: 'Disk ve yedek kontrolü', everyMin: 15 })
  async watch() {
    const disk = await this.disk();
    const free = `${gb(disk.free)} GB boş (%${Math.round((disk.free / disk.total) * 100)}), toplam ${gb(disk.total)} GB.`;
    if (disk.level === 'fail') {
      void this.alerts.raise('infra.disk_full', `Sunucu diskinde ${free} Veritabanı yazamaz hale gelmeden yer açılmalı (eski yedekler, loglar, yüklemeler).`);
    } else {
      void this.alerts.clear('infra.disk_full');
    }
    if (disk.level === 'warn') void this.alerts.raise('infra.disk_low', `Sunucu diskinde ${free}`);
    else if (disk.level === 'ok') void this.alerts.clear('infra.disk_low');

    const b = await this.backup();
    const level = backupLevel(b);
    if (level === 'warn' && b.ok === false) {
      void this.alerts.raise('backup.failed', `Son yedek hata verdi (${b.finishedAt?.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}). Sunucuda yedek logunu kontrol edin.`);
    } else if (level === 'warn') {
      const when = b.finishedAt ? `son başarılı yedek ${b.finishedAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : (b.problem ?? 'yedek bilgisi yok');
      void this.alerts.raise('backup.stale', `Son ${BACKUP_MAX_AGE_H} saatte yedek alınmadı: ${when}.`);
    } else {
      void this.alerts.clear('backup.failed');
      void this.alerts.clear('backup.stale');
    }
    return { freeGb: Number(gb(disk.free)), disk: disk.level, backup: level };
  }
}
