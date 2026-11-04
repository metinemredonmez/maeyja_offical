export type JobInfo = {
  name: string;
  /** Shown in the admin (Turkish). */
  label: string;
  /** How often it is scheduled, in minutes; a job silent for twice this (+10 min) is late. */
  everyMin: number;
  target: object;
  method: string;
};

/** Every @Tracked job, filled in as the classes load. */
export const JOBS = new Map<string, JobInfo>();

export interface JobRunner {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

/** Set by CronTrackerService once it exists; scripts and unit tests run the jobs untracked. */
let runner: JobRunner | null = null;
export const setJobRunner = (r: JobRunner | null) => {
  runner = r;
};

/**
 * Records each run of a scheduled job (admin → Zamanlanmış işler) and alerts when it fails. Put it right under
 * @Cron; the scheduler's metadata is copied onto the wrapper either way. The method still returns what it returned.
 */
export function Tracked(name: string, opts: { label: string; everyMin: number }): MethodDecorator {
  return (target, key, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const wrapped = function (this: unknown, ...args: unknown[]) {
      return runner ? runner.run(name, () => original.apply(this, args)) : original.apply(this, args);
    };
    for (const k of Reflect.getMetadataKeys(original)) Reflect.defineMetadata(k, Reflect.getMetadata(k, original), wrapped);
    Object.defineProperty(wrapped, 'name', { value: original.name });
    descriptor.value = wrapped;
    JOBS.set(name, { name, ...opts, target: target.constructor, method: String(key) });
    return descriptor;
  };
}
