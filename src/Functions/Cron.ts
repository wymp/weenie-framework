import * as E from "@openfinance/http-errors";
import { SimpleLoggerInterface } from "ts-simple-interfaces";
import { Cronjob } from "weenie-base";
import { TaggedLogger } from "../TaggedLogger";

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

export const cron = async (r: {
  logger: SimpleLoggerInterface;
  svc?: {
    initTimeout: Promise<unknown>;
    initialized: () => boolean;
  };
}) => {
  const waiter = r.svc ? r.svc.initTimeout : Promise.resolve(true);
  return { cron: new Cron(r.logger, waiter) };
};

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
      job: Cronjob;
      timer: any;
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
        if (this.crontab[name].timer === null) {
          this.initJob(this.crontab[name].job);
        }
      }
    });
  }

  /**
   * Registers cron jobs in the crontab and initializes them if the service is ready
   */
  public async register(jobOrJobs: Cronjob | Array<Cronjob>): Promise<void> {
    const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];

    // Add jobs to crontab
    for (let job of jobs) {
      this.crontab[job.name] = {
        job,
        timer: null,
      };
      this.initJob(job);
    }
  }

  protected initJob(job: Cronjob) {
    if (this.ready) {
      this.log.info(`CRON: Registering cronjob ${job.name}`);
      const log = new TaggedLogger(`CRON: ${job.name}: `, this.log);

      // Make a variable reference for the job itself
      let cronjob: () => Promise<void>;
      cronjob = async () => {
        // Try running the job and log failures
        try {
          log.debug(`Running`);
          const result = await job.handler(log);
          if (!result) {
            log.error(`Cronjob failed.`);
          } else {
            log.notice(`Completed successfully`);
          }
        } catch (e) {
          log.error(`Cronjob failed: ${e.message}`);
          log.debug(e.stack);
        }

        // Figure out when we should fire next

        // Set the next timeout with the given cron interval
        this.crontab[job.name].timer = setTimeout(cronjob, this.calculateCronInterval(job));
      };

      // Finally, kick off the timer
      this.crontab[job.name].timer = setTimeout(cronjob, this.calculateCronInterval(job));
    }
  }

  /**
   * TODO: This is a very rough initial implementation that still has lots of problems. We need
   * to fix this up. For now, we're just throwing errors if the spec can't be acted on.
   */
  protected calculateCronInterval(job: Cronjob): number {
    if (job.spec.t === "interval") {
      return job.spec.ms;
    }

    const cron = job.spec.clock;
    if (
      cron[3] !== "*" ||
      cron[4] !== "*" ||
      cron[5] !== "*" ||
      (cron[2] !== "*" && (cron[1] === "*" || cron[0] === "*")) ||
      (cron[1] !== "*" && cron[0] === "*")
    ) {
      throw new E.NotImplemented(
        `Complex cronjob specs are not yet supported. For now, you may only use the second [0], ` +
          `minute [1], and hour [2] fields, and there may not be any asterisks to the left of any ` +
          `concrete values (e.g., [ "*", "0", "8", .... ] is not allowed).`
      );
    }

    const d = new Date();
    const now = [d.getSeconds() + 1, d.getMinutes() + 1, d.getHours() + 1];

    // Start by getting us to the next full second
    let ms: number = 1000 - d.getMilliseconds();

    // Now calculate how many more ms til the next second mark
    if (cron[0] !== "*") {
      const i = parseInt(cron[0]);
      ms += (now[0] < i ? i - now[0] : 60 + i - now[0]) * 1000;
    }

    // Now how many more ms til the next minute mark
    if (cron[1] !== "*") {
      const i = parseInt(cron[1]);
      ms += (now[1] < i ? i - now[1] : 60 + i - now[1]) * 60000;
    }

    // Now how many more ms til the next hour mark
    if (cron[2] !== "*") {
      const i = parseInt(cron[2]);
      ms += (now[2] < i ? i - now[2] : 24 + i - now[2]) * 3600000;
    }

    return ms;
  }

  /**
   * Kill one or all jobs
   */
  public kill(name?: string): void {
    if (name) {
      if (typeof this.crontab[name] !== "undefined") {
        clearTimeout(this.crontab[name].timer);
      }
    } else {
      for (let n in this.crontab) {
        clearTimeout(this.crontab[n].timer);
      }
    }
  }
}
