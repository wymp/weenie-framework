import {
  Weenie,
  logger,
  mysql,
  configFromFiles,
  baseConfigValidator,
  databaseConfigValidator,
} from "./";
import * as rt from "runtypes";

// Create final config definition
const exampleConfigValidator = rt.Intersect(
  baseConfigValidator,
  rt.Record({
    db: databaseConfigValidator,
  })
);
declare type ExampleConfig = rt.Static<typeof exampleConfigValidator>;

const r = Weenie(
  configFromFiles<ExampleConfig>(
    "./config.example.json",
    "./config.local.json",
    exampleConfigValidator
  )()
)
.and(logger)
.and(mysql)
    /*
.and(api)
.and(Io)
.done((d) => {
  return {
    config: d.config,
    log: d.logger,
    io: d.io,
  }
});
     */

r.logger.notice(`App started in environment '${r.config.envName}'`);
r.logger.notice(`Available databases:`);
r.sql.query<{Database: string}>("SHOW DATABASES").then((result) => {
  for (let row of result.rows) {
    r.logger.notice(`* ${row.Database}`);
  }

  const db: any = r.sql;
  if (db.close) {
    db.close();
  }
});
