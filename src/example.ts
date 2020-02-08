import {
  Weenie,
  logger,
  mysql,
  httpHandler,
  configFromFiles,
  baseConfigValidator,
  databaseConfigValidator,
  webServiceConfigValidator,
} from "./";
import * as rt from "runtypes";

// Create final config definition
const exampleConfigValidator = rt.Intersect(
  baseConfigValidator,
  rt.Record({
    db: databaseConfigValidator,
    webservice: webServiceConfigValidator,
  })
);
declare type ExampleConfig = rt.Static<typeof exampleConfigValidator>;

// Instantiate all dependencies
const r = Weenie(
  configFromFiles<ExampleConfig>(
    "./config.example.json",
    "./config.local.json",
    exampleConfigValidator
  )()
)
.and(logger)
.and(mysql)
.and(httpHandler({}))
    /*
.and(Io)
.done((d) => {
  return {
    config: d.config,
    log: d.logger,
    io: d.io,
  }
});
     */

// Use dependencies for whatever you want
r.logger.notice(`App started in environment '${r.config.envName}'`);
r.logger.notice(`Available databases:`);

// Make database call
r.sql.query<{Database: string}>("SHOW DATABASES").then((result) => {
  for (let row of result.rows) {
    r.logger.notice(`* ${row.Database}`);
  }

  // Close the database cause we're done with it
  const db: any = r.sql;
  if (db.close) {
    db.close();
  }

  // Set up our webservice
  r.http.get("/info", (req, res, next) => {
    res.send({ status: "success", message: "Yay!" });
  });
  r.http.listen();

  // Make an API call using the primary API
  /*
  r.api.request<any>({ url: "/todos/1" }).then((response) => {
    r.logger.notice(`Got response from API: ${response.status} ${JSON.stringify(response.data)}`);
  });
   */
});
