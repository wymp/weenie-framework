import * as rt from "runtypes";

/**
 * CONFIG STRUCTURE DEFINITIONS
 *
 * The following definitions are more convenience than mandate. All frameworks work by establishing
 * certain conventions and enforcing certain assumptions. Since this is a micro-framework, it
 * doesn't go so far as to "enforce" the conventions laid out here. However, following them is
 * expected to bring lots of benefit and very little cost.
 */

/**
 * A webservice should specify one or more listening ports with optional hosts (may be the same
 * port on multiple hosts)
 */
const Port = rt.Number;
const Host = rt.String;
export const webServiceConfigValidator = rt.Record({
  listeners: rt.Array(rt.Tuple(Port, rt.Optional(Host))),
  logIncoming: rt.Optional(rt.Union(rt.Null, rt.Boolean)),
  parseJson: rt.Optional(rt.Union(rt.Null, rt.Boolean)),
  jsonMimeTypes: rt.Optional(rt.Union(rt.Null, rt.Array(rt.String))),
  handleErrors: rt.Optional(rt.Union(rt.Null, rt.Boolean)),
  handleFallthrough: rt.Optional(rt.Union(rt.Null, rt.Boolean)),
  listenOnReady: rt.Optional(rt.Union(rt.Null, rt.Boolean)),
  mask500Errors: rt.Optional(rt.Union(rt.Null, rt.Boolean, rt.String)),
  errOnBlankPost: rt.Optional(rt.Union(rt.Null, rt.Boolean)),
});
export type WebServiceConfig = rt.Static<typeof webServiceConfigValidator>;

/**
 * This config provides a very basic model for API access, where a given API requires an API key
 * and secret and has a base URL that is configurable per-environment.
 */
export const apiConfigValidator = rt.Record({
  key: rt.String,
  secret: rt.String,
  baseUrl: rt.String,
});
export type ApiConfig = rt.Static<typeof apiConfigValidator>;

/**
 * This is mostly just a runtime validation of AMQP configs
 */
export const mqConnectionConfigValidator = rt.Record({
  protocol: rt.Optional(rt.Literal("amqp")),
  hostname: rt.Optional(rt.String),
  port: rt.Optional(rt.Number),
  username: rt.Optional(rt.String),
  password: rt.Optional(rt.String),
  locale: rt.Optional(rt.String),
  vhost: rt.Optional(rt.String),
  heartbeat: rt.Optional(rt.Number),
});
export type MqConnectionConfig = rt.Static<typeof mqConnectionConfigValidator>;

/**
 * Mostly just a runtime validation of MySQL configs
 */
export const databaseConfigValidator = rt.Union(
  rt.Record({
    host: rt.Union(rt.String, rt.Undefined, rt.Null),
    port: rt.Union(rt.Number, rt.Undefined, rt.Null),
    socketPath: rt.Optional(rt.Union(rt.Undefined, rt.Null)),
    user: rt.String,
    password: rt.String,
    database: rt.String,
  }),
  rt.Record({
    host: rt.Optional(rt.Union(rt.Undefined, rt.Null)),
    port: rt.Optional(rt.Union(rt.Undefined, rt.Null)),
    socketPath: rt.String,
    user: rt.String,
    password: rt.String,
    database: rt.String,
  })
);
export type DatabaseConfig = rt.Static<typeof databaseConfigValidator>;

/**
 * Defines a logfile path and a level at which to write logs
 */
export const loggerConfigValidator = rt.Record({
  logLevel: rt
    .Literal("debug")
    .Or(rt.Literal("info"))
    .Or(rt.Literal("notice"))
    .Or(rt.Literal("warning"))
    .Or(rt.Literal("error"))
    .Or(rt.Literal("alert"))
    .Or(rt.Literal("critical"))
    .Or(rt.Literal("emergency")),

  // If this is null, then logs are only written to stdout
  logFilePath: rt.Optional(rt.String.Or(rt.Null)),
});
export type LoggerConfig = rt.Static<typeof loggerConfigValidator>;

/**
 * Define a configuration that is aware of its environment
 */
export const environmentAwareConfigValidator = rt.Record({
  /** Defines an environment type, e.g., 'dev', 'uat', 'qa', 'staging', 'prod' */
  envType: rt.String,

  /** Defines a specific environment name, e.g., 'dev', 'demo1', 'demo2', 'staging', 'prod' */
  envName: rt.String,
});
export type EnvironmentAwareConfig = rt.Static<typeof environmentAwareConfigValidator>;

/**
 * A configuration that specifies parameters for a job manager
 */
export const jobManagerConfigValidator = rt.Record({
  /**
   * This is the intitial time in ms that we should wait before retrying a failed job.
   *
   * This is intended to be used by an exponential backoff system, where the system takes this
   * parameter and doubles it on each failed attempt.
   */
  initialJobWaitMs: rt.Optional(rt.Number),

  /** Maximum time to wait in ms before the application should stop retrying a failed job */
  maxJobWaitMs: rt.Optional(rt.Number),
});
export type JobManagerConfig = rt.Static<typeof jobManagerConfigValidator>;

/**
 * Config for a module that manages a running service
 */
export const serviceManagerConfigValidator = rt.Record({
  /** Maximum time to wait in ms for the application to start before we should throw an error */
  initializationTimeoutMs: rt.Number,
});
export type ServiceManagerConfig = rt.Static<typeof serviceManagerConfigValidator>;

/**
 * Brings all the config validators together into a cohesive collection
 *
 * The framework config is a combination of environment-aware config, job manager config and
 * service manager config with the addition of specific subgroups for logging, amqp, db, and
 * webservice config.
 */
export const baseConfigValidator = rt.Intersect(
  environmentAwareConfigValidator,
  jobManagerConfigValidator,
  serviceManagerConfigValidator,
  rt.Record({
    /** The service name */
    serviceName: rt.String,

    /** Logger configuration */
    logger: loggerConfigValidator,
  })
);
export type BaseConfig = rt.Static<typeof baseConfigValidator>;
