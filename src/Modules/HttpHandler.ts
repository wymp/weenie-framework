import * as E from "@openfinanceio/http-errors";
import { logger } from "@wymp/http-utils";
import {
  SimpleLoggerInterface,
  SimpleHttpServerErrorHandler,
  SimpleLogLevels,
} from "@wymp/ts-simple-interfaces";
import { WebServiceConfig } from "../Types";
import { SimpleHttpServerExpress, Parsers } from "@wymp/simple-http-server-express";

export function httpHandler(d: {
  config: { webservice: WebServiceConfig } | { http: WebServiceConfig };
  logger: SimpleLoggerInterface;
  // Maybe a service manager
  svc?: { ready: Promise<void> } | { initTimeout: Promise<void> };
}) {
  const config = getWithFallback<WebServiceConfig>(d.config, "http", "webservice");
  const http = new SimpleHttpServerExpress({ listeners: config.listeners }, d.logger);

  // Log every incoming request
  http.use((req, res, next) => {
    const log = logger(d.logger, req, res);
    log.info(`Request received`);
    next();
  });

  // Parse incoming bodies (JSON only)
  http.use(Parsers.json({ type: ["application/json", "application/json-rpc"] }));

  // If svc manager available, add auto-listening on initialization
  let tcpListeners: Array<{ close(): unknown }> = [];
  if (d.svc && (config.handleErrors !== false || config.handleFallthrough !== false)) {
    const ready = getWithFallback<Promise<void>>(d.svc, "ready", "initTimeout");
    ready.then(() => {
      // Add fallthrough handling, if requested
      if (config.handleFallthrough !== false) {
        http.use((req, res, next) => {
          const log = logger(d.logger, req, res);
          log.notice(`Request not fulfilled. Returning 400 error.`);
          next(
            new E.BadRequest(
              `Endpoint '${req.method} ${req.path}' does not exist on this server. Please read the ` +
                `docs and try again.`,
              `ENDPOINT-NOT-FOUND.${req.method}:${req.path}`
            )
          );
        });
      }

      // Add standard error handling, if requested
      if (config.handleErrors !== false) {
        http.catch(StandardErrorHandler(d.logger));
      }

      // Start listening, saving the returned listeners
      tcpListeners = http.listen();
    });
  }

  return {
    http,
    // 2021-04-07: This must be a function because if not, the variable reference gets lost somewhere
    getTcpListeners: () => tcpListeners,
  };
}

const getWithFallback = <T>(d: any, k1: string, k2: string): T => d[k1] || d[k2];

export const StandardErrorHandler = (_log: SimpleLoggerInterface): SimpleHttpServerErrorHandler => {
  return (e, req, res, next) => {
    const log = logger(_log, req, res);

    // Save original in case it's a JSON-RPC request
    const originalError = e;

    if (!E.isHttpError(e)) {
      const stack = e.stack;
      e = E.InternalServerError.fromError(e);
      e.stack = stack;
    }

    const level = <keyof SimpleLogLevels>(e.loglevel ? e.loglevel : "error");
    log[level](
      `Exception thrown: ${e.name} (${e.status}: ` +
        `'${e.subcode! || e.code!}') ${e.message}` +
        e.obstructions?.length
        ? ` Obstructions:\n${JSON.stringify(e.obstructions, null, 2)}`
        : ""
    );
    log[level]("Stack trace: " + e.stack);

    // Prepare error envelope
    let errorResponse: any = {};
    const accept = res.locals.accept || req.get("accept") || null;
    if (accept && accept.match(/application\/json-rpc/)) {
      res.set("Content-Type", "application/json-rpc");

      // If using JSON-RPC, pack the error into a JSON-RPC error container
      if (typeof originalError.serialize === "function") {
        // If we have a serialize method, then use it (from jsonrpc-lite package)
        errorResponse = originalError.serialize();
        if (typeof errorResponse !== "string") {
          errorResponse = JSON.stringify(errorResponse);
        }
      } else {
        // Warn if request id not set in res.locals
        if (!res.locals.jsonrpcRequestId) {
          log.warning(
            `Handling a JSON-RPC error, but no request id found. Please be sure to set the ` +
              `res.locals.jsonrpcRequestId variable to the request id at the beginning of the ` +
              `request.`
          );
        }

        // Otherwise, create a new error response
        errorResponse = JSON.stringify({
          jsonrpc: "2.0" as "2.0",
          id: res.locals.jsonrpcRequestId || null,
          error: {
            code: e.status ? e.status : e.code && typeof e.code === "number" ? e.code! : 500,
            message: e.message,
            data: {
              obstructions: e.obstructions,
            },
          },
        });
      }
    } else {
      // Only using json for now
      res.set("Content-Type", "application/json");

      // If not JSON-RPC, pack the error response into a standard error object
      errorResponse = {
        error: {
          status: e.status,
          code: e.subcode! || e.code!,
          title: e.name,
          detail: e.message,
          obstructions: e.obstructions || [],
        },
      };

      // Serialize it
      errorResponse = JSON.stringify(errorResponse);
    }

    // Add any headers that might have been specified with the error
    for (const k in e.headers) {
      // Skip certain headers
      if (k.toLowerCase() === "content-type") {
        continue;
      }
      res.set(k, e.headers[k]);
    }

    // Send it off
    res.status(e.status).send(errorResponse);
  };
};
