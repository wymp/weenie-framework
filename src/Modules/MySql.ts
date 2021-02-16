import { DatabaseConfig } from "../Types";
import { SimpleSqlDbInterface } from "@wymp/ts-simple-interfaces";
import { SimpleDbMysql } from "@wymp/simple-db-mysql";

type PartialConfig = { db: DatabaseConfig };
type FullConfig = { config: PartialConfig };

type SqlDep = { sql: SimpleSqlDbInterface };

export function mysql(deps: FullConfig | PartialConfig | DatabaseConfig): SqlDep {
  const d = <FullConfig>(
    (typeof (deps as FullConfig).config !== "undefined"
      ? deps
      : typeof (deps as PartialConfig).db !== "undefined"
      ? { config: deps }
      : { config: { db: deps } })
  );

  return {
    sql: new SimpleDbMysql({
      ...d.config.db,
      host: d.config.db.host || undefined,
      port: d.config.db.port || undefined,
      socketPath: d.config.db.socketPath || undefined,
    }),
  };
}
