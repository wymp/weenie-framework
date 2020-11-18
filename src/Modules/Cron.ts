import { SimpleLoggerInterface, TaggedLogger } from "ts-simple-interfaces";
import { CronJob as CronProvider } from "cron";

/**
 * Types
 */
export interface CronjobInterface {
  name: string;
  spec: string;
  tz?: string;
  handler: (log: SimpleLoggerInterface) => Promise<boolean>;
}

export interface CronInterface {
  register(jobOrJobs: CronjobInterface | Array<CronjobInterface>): void;
  kill(name?: string): void;
}

/**
 *
 *
 *
 *
 *
 * Logic
 *
 *
 *
 *
 */

export const cron = (r: {
  logger: SimpleLoggerInterface;
  svc?: {
    initTimeout: Promise<unknown>;
    initialized: () => boolean;
  };
}) => {
  const waiter = r.svc ? r.svc.initTimeout : Promise.resolve(true);
  return { cron: new Cron(r.logger, waiter) };
};

export const mockCron = () => ({ cron: new MockCron() });

/**
 * NOTE: Cronjobs use setTimeout instead of setInterval because we don't want
 * it to be possible for them to be defined in such a way that they run constantly
 * (e.g., a job that takes 10 seconds to run, defined on a 5-second interval).
 */
export class Cron {
  /**
   * Tracks active cronjobs
   */
  protected crontab: {
    [name: string]: {
      job: CronjobInterface;
      provider: CronProvider | null;
    };
  } = {};

  /**
   * Captures the initialization timeout
   */
  protected ready: boolean;

  public constructor(protected log: SimpleLoggerInterface, protected initWait: Promise<unknown>) {
    // On initialization, initialize any currently uninitialized cronjobs
    initWait.then(() => {
      this.ready = true;
      for (let name in this.crontab) {
        if (this.crontab[name].provider === null) {
          this.initJob(this.crontab[name].job);
        }
      }
    });
  }

  /**
   * Registers cron jobs in the crontab and initializes them if the service is ready
   */
  public register(jobOrJobs: CronjobInterface | Array<CronjobInterface>): void {
    const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];

    // Add jobs to crontab
    for (let job of jobs) {
      this.crontab[job.name] = {
        job,
        provider: null,
      };
      this.initJob(job);
    }
  }

  protected initJob(job: CronjobInterface) {
    if (this.ready) {
      this.log.info(`CRON: Registering cronjob ${job.name}`);
      const log = new TaggedLogger(`CRON: ${job.name}: `, this.log);

      // Roll the job into a structure with logging (has to return void, so we're swallowing errors
      const cronjob = () => {
        // Try running the job and log failures
        log.debug(`Running`);
        job
          .handler(log)
          .then(result => {
            if (!result) {
              log.error(`Cronjob failed.`);
            } else {
              log.notice(`Completed successfully`);
            }
          })
          .catch(e => {
            log.error(`Cronjob failed: ${e.message}`);
            log.debug(e.stack);
          });
      };

      // Finally, kick off the job using the cron provider
      this.crontab[job.name].provider = new CronProvider(job.spec, cronjob, null, true, job.tz);
    }
  }

  /**
   * Kill one or all jobs
   */
  public kill(name?: string): void {
    if (name) {
      if (typeof this.crontab[name] !== "undefined") {
        const p = this.crontab[name].provider;
        if (p !== null) {
          p.stop();
        }
      }
    } else {
      for (let n in this.crontab) {
        const p = this.crontab[n].provider;
        if (p !== null) {
          p.stop();
        }
      }
    }
  }
}

export class MockCron implements CronInterface {
  private _jobs: Array<CronjobInterface & { killed: boolean }> = [];

  public get jobs(): Array<CronjobInterface & { readonly killed: boolean }> {
    return this._jobs;
  }

  public register(jobOrJobs: CronjobInterface | Array<CronjobInterface>): void {
    if (!Array.isArray(jobOrJobs)) {
      this._jobs.push({ ...jobOrJobs, killed: false });
    } else {
      this._jobs = this._jobs.concat(jobOrJobs.map(j => ({ ...j, killed: false })));
    }
  }
  public kill(name?: string): void {
    (name ? this._jobs.filter(j => j.name === name) : this._jobs).map(j => (j.killed = true));
  }
}
