import * as F from "../src/Functions";
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
    const { logger: log } = F.logger({ logLevel: "debug", logFilePath });

    log.debug("DEBUG");
    log.info("INFO");
    log.notice("NOTICE");
    log.warning("WARNING");
    log.error("ERROR");
    log.alert("ALERT");
    log.critical("CRITICAL");
    log.emergency("EMERGENCY");

    const dateRegexp = "20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}";

    await new Promise((res, rej) => setTimeout(() => res(), 500));

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
    const d = F.logger({ logLevel: "warning", logFilePath });
    const log = d.logger;

    log.debug("DEBUG");
    log.info("INFO");
    log.notice("NOTICE");
    log.warning("WARNING");
    log.error("ERROR");
    log.alert("ALERT");
    log.critical("CRITICAL");
    log.emergency("EMERGENCY");

    await new Promise((res, rej) => setTimeout(() => res(), 500));

    const contents = fs.readFileSync(logFilePath, "utf8").split("\n");
    expect(contents.length).toBe(6);
    expect(contents[0]).toMatch(new RegExp(`WARNING`));
    expect(contents[1]).toMatch(new RegExp(`ERROR`));
    expect(contents[2]).toMatch(new RegExp(`ALERT`));
    expect(contents[3]).toMatch(new RegExp(`CRITICAL`));
    expect(contents[4]).toMatch(new RegExp(`EMERGENCY`));
  });
});
