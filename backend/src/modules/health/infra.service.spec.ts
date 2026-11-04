import { Logger } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { backupLevel, diskLevel, InfraService, parseBackupStatus } from './infra.service';

Logger.overrideLogger(false);
const GB = 1024 ** 3;

describe('disk level', () => {
  it('is fine with room to spare, warns early, fails before the database runs out', () => {
    expect(diskLevel(40 * GB, 100 * GB)).toBe('ok');
    expect(diskLevel(10 * GB, 100 * GB)).toBe('warn'); // under 15 %
    expect(diskLevel(4 * GB, 20 * GB)).toBe('warn'); // 20 %, but under the 5 GB floor
    expect(diskLevel(1 * GB, 10 * GB)).toBe('fail'); // under the 1.5 GB floor
    expect(diskLevel(4 * GB, 100 * GB)).toBe('fail'); // under 5 %
  });

  it('does not cry wolf on a big disk', () => {
    expect(diskLevel(23 * GB, 926 * GB)).toBe('ok'); // 2.5 %, but above the 20 GB ceiling
    expect(diskLevel(12 * GB, 926 * GB)).toBe('warn');
    expect(diskLevel(4 * GB, 926 * GB)).toBe('fail');
  });
});

describe('backup status', () => {
  const now = new Date('2026-11-05T10:00:00Z').getTime();
  const state = (finishedAt: string | null, ok: boolean | null) => ({ configured: true, finishedAt: finishedAt ? new Date(finishedAt) : null, ok, bytes: 1, problem: null });

  it('reads what backup.sh writes and rejects anything else', () => {
    expect(parseBackupStatus('{"finishedAt":"2026-11-05T00:31:02Z","ok":true,"bytes":123}')).toMatchObject({ ok: true, bytes: 123, problem: null });
    expect(parseBackupStatus('not json').problem).toBeTruthy();
    expect(parseBackupStatus('{"finishedAt":"yesterday","ok":true}').problem).toBeTruthy();
  });

  it('is ok within 30 hours, warns when older, failed or missing, and is off when not configured', () => {
    expect(backupLevel(state('2026-11-05T00:30:00Z', true), now)).toBe('ok');
    expect(backupLevel(state('2026-11-04T00:30:00Z', true), now)).toBe('warn');
    expect(backupLevel(state('2026-11-05T00:30:00Z', false), now)).toBe('warn');
    expect(backupLevel(state(null, null), now)).toBe('warn');
    expect(backupLevel({ configured: false, finishedAt: null, ok: null, bytes: null, problem: null }, now)).toBe('off');
  });
});

describe('InfraService', () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'infra-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function setup(dbUp: boolean, backupFile: string) {
    const prisma = { $queryRaw: jest.fn(async () => (dbUp ? [{ size: BigInt(1) }] : Promise.reject(new Error('down')))) };
    const tracker = { list: jest.fn(async () => [{ label: 'x', lateMin: 0 }]) };
    const alerts = { raise: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) };
    const env: Record<string, string> = { UPLOAD_DIR: dir, BACKUP_STATUS_FILE: backupFile, NODE_ENV: 'test' };
    const svc = new InfraService(prisma as never, alerts as never, tracker as never, { get: (k: string) => env[k] } as never);
    return { svc, alerts };
  }

  it('tells uptime monitors "down" only when the database is unreachable', async () => {
    const file = join(dir, 'status.json');
    writeFileSync(file, JSON.stringify({ finishedAt: new Date().toISOString(), ok: true, bytes: 10 }));
    expect((await setup(true, file).svc.readiness()).checks).toMatchObject({ db: 'ok', backup: 'ok', jobs: 'ok' });
    const down = await setup(false, file).svc.readiness();
    expect(down.status).toBe('down');
    expect(down.checks.db).toBe('fail');
  });

  it('raises backup.stale when the status file is missing and clears it once a backup is recorded', async () => {
    const file = join(dir, 'status.json');
    const { svc, alerts } = setup(true, file);
    await svc.watch();
    expect(alerts.raise).toHaveBeenCalledWith('backup.stale', expect.stringContaining('yedek betiği'));
    writeFileSync(file, JSON.stringify({ finishedAt: new Date().toISOString(), ok: true, bytes: 10 }));
    await svc.watch();
    expect(alerts.clear).toHaveBeenCalledWith('backup.stale');
  });
});
