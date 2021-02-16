import * as M from "../src/Modules";
import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import { MockSimpleLogger } from "@wymp/ts-simple-interfaces-testing";
import * as fs from "fs";

describe("Logger", () => {
  const logFilePath = process.env.PWD + "/test.logger.log";

  beforeEach(() => {
    if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
  });
  afterEach(() => {
    if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
  });

  it("should log to our file", async () => {
    const { logger: log } = M.logger({ logLevel: "debug", logFilePath });

    log.debug("DEBUG");
    log.info("INFO");
    log.notice("NOTICE");
    log.warning("WARNING");
    log.error("ERROR");
    log.alert("ALERT");
    log.critical("CRITICAL");
    log.emergency("EMERGENCY");

    const dateRegexp = "20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}";

    await new Promise<void>((res, rej) => setTimeout(() => res(), 500));

    const contents = fs.readFileSync(logFilePath, "utf8").split("\n");
    expect(contents.length).toBe(9);
    expect(contents[0]).toMatch(new RegExp(`^${dateRegexp} \\[debug\\]:[ \t]+DEBUG`));
    expect(contents[1]).toMatch(new RegExp(`^${dateRegexp} \\[info\\]:[ \t]+INFO`));
    expect(contents[2]).toMatch(new RegExp(`^${dateRegexp} \\[notice\\]:[ \t]+NOTICE`));
    expect(contents[3]).toMatch(new RegExp(`^${dateRegexp} \\[warning\\]:[ \t]+WARNING`));
    expect(contents[4]).toMatch(new RegExp(`^${dateRegexp} \\[error\\]:[ \t]+ERROR`));
    expect(contents[5]).toMatch(new RegExp(`^${dateRegexp} \\[alert\\]:[ \t]+ALERT`));
    expect(contents[6]).toMatch(new RegExp(`^${dateRegexp} \\[crit\\]:[ \t]+CRITICAL`));
    expect(contents[7]).toMatch(new RegExp(`^${dateRegexp} \\[emerg\\]:[ \t]+EMERGENCY`));
  });

  it("should not log below the given log level", async () => {
    const d = M.logger({ logLevel: "warning", logFilePath });
    const log = d.logger;

    log.debug("DEBUG");
    log.info("INFO");
    log.notice("NOTICE");
    log.warning("WARNING");
    log.error("ERROR");
    log.alert("ALERT");
    log.critical("CRITICAL");
    log.emergency("EMERGENCY");

    await new Promise<void>((res, rej) => setTimeout(() => res(), 500));

    const contents = fs.readFileSync(logFilePath, "utf8").split("\n");
    expect(contents.length).toBe(6);
    expect(contents[0]).toMatch(new RegExp(`WARNING`));
    expect(contents[1]).toMatch(new RegExp(`ERROR`));
    expect(contents[2]).toMatch(new RegExp(`ALERT`));
    expect(contents[3]).toMatch(new RegExp(`CRITICAL`));
    expect(contents[4]).toMatch(new RegExp(`EMERGENCY`));
  });
});

describe("Cron Module", () => {
  describe("Cron Class", () => {
    let r: {
      logger: MockSimpleLogger;
      svc?: { initTimeout: Promise<unknown>; initialized: (i?: true) => boolean };
    };
    let c: M.Cron;

    beforeEach(() => {
      r = { logger: new MockSimpleLogger({ outputMessages: false }) };
    });
    afterEach(() => {
      c.kill();
    });

    [false, true].map(svc => {
      test(`should successfully run clock cronjobs ${
        svc ? `with` : `without`
      } svc dependency`, async () => {
        const wait: number = 3025;
        let actual: number = 0;
        let expected: number = 3;

        if (svc) {
          expected = 2;
          r.svc = {
            initTimeout: new Promise<void>(r => setTimeout(() => r(), 1000)),
            initialized: (i?: true) => !!i,
          };
        }

        // Get a cron manager
        const { cron } = await M.cron(r);
        c = cron;

        c.register({
          name: "Test Job",
          spec: "* * * * * *",
          handler: (log: SimpleLoggerInterface) => {
            actual++;
            return Promise.resolve(true);
          },
        });

        await new Promise<void>(res => setTimeout(() => res(), wait));
        expect(actual).toBe(expected);
      });
    });
  });

  describe("MockCron Class", () => {
    test("should keep records on registered cronjobs without executing them", () => {
      let called: boolean = false;
      const job = {
        name: "testcron",
        spec: "* * * * * *",
        handler: (log: SimpleLoggerInterface) => {
          called = true;
          return Promise.resolve(true);
        },
      };

      // Register a job and make sure it doesn't get called
      const c = new M.MockCron();
      c.register(job);
      expect(called).toBe(false);
      expect(c.jobs).toHaveLength(1);
      expect(c.jobs[0]!.killed).toBe(false);

      // Typescript: Make sure we can't inappropriately kill a job (uncomment this)
      //c.jobs[0]!.killed = true;

      // Make sure we can target our killing
      c.kill("not-a-job");
      expect(c.jobs[0]!.killed).toBe(false);

      // Kill all jobs and make sure they get marked as killed
      c.kill();
      expect(c.jobs[0]!.killed).toBe(true);
    });
  });
});

describe("Backoff", () => {
  describe("SimpleExponentialBackoff", () => {
    const log = new MockSimpleLogger({ outputMessages: false });

    it("should execute with exponential backoff on fail", async function() {
      const backoff = new M.SimpleExponentialBackoff({ initialJobWaitMs: 20 });
      let n = 0;
      const results: Array<[number, number]> = [];

      let last = Date.now();
      await backoff.run(async () => {
        last += n;
        results.push([Date.now(), last]);
        n = n === 0 ? 20 : n * 2;
        return n > 320;
      }, log);

      expect(results.length).toBe(6);
      let radius = 15;
      for (let i = 0; i < results.length; i++) {
        const [val, targ] = results[i];
        const msg = `Failed at round ${i + 1}. Actual is ${val}, target is ${targ}, +/-${radius}`;
        expect({ msg, val: val >= targ - radius && val <= targ + radius }).toEqual({
          msg,
          val: true,
        });
      }
    });
  });
});
