import { LoggerConfig } from "weenie-base";
import { SimpleLoggerInterface } from "ts-simple-interfaces";
import { SimpleLoggerWinston } from "simple-logger-winston";
import * as winston from "winston";

type PartialConfig = { logger: LoggerConfig };
type FullConfig = { config: PartialConfig };

type LoggerDep = { logger: SimpleLoggerInterface };

export function logger(deps: FullConfig | PartialConfig | LoggerConfig): LoggerDep {
  const d = <FullConfig>(
    (typeof (deps as FullConfig).config !== "undefined"
      ? deps
      : typeof (deps as PartialConfig).logger !== "undefined"
      ? { config: deps }
      : { config: { logger: deps } })
  );

  // (Length of 'warning', the longest log level as written by Winston)
  const padLen = 7;

  // Winston doesn't re-export the general interface `Transport` from `winston-transport`, and we
  // don't want to depend on `winston-transport` just to define this type, so we're just going
  // with `any` here.
  const transports: Array<any> = [new winston.transports.Console({ handleExceptions: true })];
  if (d.config.logger.logFilePath) {
    transports.push(
      new winston.transports.File({
        filename: d.config.logger.logFilePath,
        level: d.config.logger.logLevel,
        handleExceptions: true,
      })
    );
  }

  return {
    logger: new SimpleLoggerWinston({
      level: d.config.logger.logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.align(),
        winston.format.printf(info => {
          const { timestamp, level, message, ...args } = info;

          const ts = timestamp.slice(0, 19).replace("T", " ");
          const levelStr = `[${level}]:`.padEnd(+padLen + 2, " ");
          return `${ts} ${levelStr} ${message}${
            Object.keys(args).length ? ` ${JSON.stringify(args, null, 2)}` : ""
          }`;
        })
      ),
      transports,
      exitOnError: false,
    }),
  };
}
