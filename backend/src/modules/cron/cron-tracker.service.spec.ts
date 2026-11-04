import 'reflect-metadata';
import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronTrackerService, minutesLate, summarize } from './cron-tracker.service';
import { JOBS, setJobRunner, Tracked } from './tracked.decorator';

Logger.overrideLogger(false);

class Jobs {
  calls = 0;
  @Cron('* * * * *')
  @Tracked('test.minute', { label: 'Dakikalık deneme', everyMin: 1 })
  async minute(): Promise<unknown> {
    this.calls++;
    return { done: 0 };
  }

  @Tracked('test.hourly', { label: 'Saatlik deneme', everyMin: 60 })
  @Cron('0 * * * *')
  async hourly() {
    return 'ok';
  }
}

function setup() {
  const prisma = {
    cronJob: { upsert: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
    cronRun: { create: jest.fn(async () => ({})) },
  };
  const alerts = { raise: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) };
  const jobs = new Jobs();
  const moduleRef = { get: jest.fn(() => jobs) };
  const tracker = new CronTrackerService(prisma as never, alerts as never, moduleRef as never);
  setJobRunner(tracker);
  return { tracker, prisma, alerts, jobs };
}

afterEach(() => setJobRunner(null));

describe('@Tracked', () => {
  it('keeps the scheduler metadata whichever side of @Cron it sits, and registers the job', () => {
    const cronKeys = (fn: unknown) => Reflect.getMetadataKeys(fn as object).filter((k) => String(k).toLowerCase().includes('schedule'));
    expect(cronKeys(Jobs.prototype.minute).length).toBeGreaterThan(0);
    expect(cronKeys(Jobs.prototype.hourly).length).toBeGreaterThan(0);
    expect(JOBS.get('test.minute')).toMatchObject({ label: 'Dakikalık deneme', everyMin: 1, method: 'minute' });
  });

  it('runs the job untracked when there is no tracker (scripts, tests)', async () => {
    await expect(new Jobs().hourly()).resolves.toBe('ok');
  });
});

describe('summarize', () => {
  it('keeps numbers, flags, short texts and list lengths only', () => {
    expect(summarize({ fetched: 2, errors: [{ email: 'a@b.co' }], ok: true, nested: { x: 1 }, note: 'x'.repeat(200) })).toEqual({ fetched: 2, errors: 1, ok: true, note: 'x'.repeat(120) });
    expect(summarize(undefined)).toBeNull();
    expect(summarize([1, 2, 3])).toEqual({ items: 3 });
  });
});

describe('minutesLate', () => {
  const boot = new Date('2026-11-04T08:00:00Z');
  const at = (iso: string) => new Date(iso).getTime();
  it('is 0 while the job keeps its rhythm', () => {
    expect(minutesLate(5, new Date('2026-11-04T09:50:00Z'), null, boot, at('2026-11-04T10:00:00Z'))).toBe(0);
  });
  it('counts past twice the interval plus ten minutes', () => {
    expect(minutesLate(5, new Date('2026-11-04T09:30:00Z'), null, boot, at('2026-11-04T10:00:00Z'))).toBe(10);
  });
  it('does not blame a job for the time the process was down', () => {
    expect(minutesLate(1, new Date('2026-11-04T07:00:00Z'), null, boot, at('2026-11-04T08:05:00Z'))).toBe(0);
  });
  it('flags a run that never finishes', () => {
    expect(minutesLate(5, new Date('2026-11-04T09:00:00Z'), new Date('2026-11-04T09:00:00Z'), boot, at('2026-11-04T11:00:00Z'))).toBe(100);
  });
});

describe('CronTrackerService', () => {
  it('records the state of every run, but keeps history of a minute job only when it did something', async () => {
    const { prisma, jobs } = setup();
    await expect(jobs.minute()).resolves.toEqual({ done: 0 });
    expect(prisma.cronJob.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.cronRun.create).not.toHaveBeenCalled();
    await jobs.hourly();
    expect(prisma.cronRun.create).toHaveBeenCalledTimes(1);
  });

  it('rethrows a failure, records it and alerts a frequent job only from the third failure in a row', async () => {
    const { tracker, alerts, prisma } = setup();
    const boom = () => Promise.reject(new Error('db gone for x@y.example'));
    for (let i = 1; i <= 3; i++) await expect(tracker.run('test.minute', boom)).rejects.toThrow('db gone');
    expect(prisma.cronRun.create).toHaveBeenCalledTimes(3);
    expect(prisma.cronRun.create.mock.calls[0]).toEqual([{ data: expect.objectContaining({ status: 'error', error: 'db gone for x***@y.example' }) }]);
    expect(alerts.raise).toHaveBeenCalledTimes(1);
    expect(alerts.raise).toHaveBeenCalledWith('cron.failed', expect.stringContaining('üst üste 3 kez'), { key: 'test.minute' });

    await tracker.run('test.minute', async () => ({ done: 1 }));
    expect(alerts.clear).toHaveBeenCalledWith('cron.failed', 'test.minute');
  });

  it('lets a second call through untracked while the job runs', async () => {
    const { tracker, prisma } = setup();
    let release!: () => void;
    const first = tracker.run('test.minute', () => new Promise<void>((r) => (release = r)));
    await expect(tracker.run('test.minute', async () => 'inner')).resolves.toBe('inner');
    expect(() => tracker.trigger('test.minute', 'admin-1')).toThrow(ConflictException);
    release();
    await first;
    expect(prisma.cronJob.upsert).toHaveBeenCalledTimes(1);
  });

  it('starts a job by hand and records who did', async () => {
    const { tracker, prisma, jobs } = setup();
    expect(() => tracker.trigger('no.such.job', 'admin-1')).toThrow(NotFoundException);
    expect(tracker.trigger('test.minute', 'admin-1')).toEqual({ started: true });
    await new Promise((r) => setImmediate(r));
    expect(jobs.calls).toBe(1);
    expect(prisma.cronRun.create.mock.calls[0]).toEqual([{ data: expect.objectContaining({ trigger: 'manual', actorId: 'admin-1' }) }]);
  });
});
