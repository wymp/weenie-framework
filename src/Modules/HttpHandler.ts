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

  // Get final options (null means "use default")
  const opts = {
    logIncoming: config.logIncoming ?? true,
    parseJson: config.parseJson ?? true,
    jsonMimeTypes: config.jsonMimeTypes ?? ["application/json", "application/json-rpc"],
    handleErrors: config.handleErrors ?? true,
    handleFallthrough: config.handleFallthrough ?? true,
    listenOnReady: config.listenOnReady ?? true,
    mask500Errors: config.mask500Errors ?? true,
    errOnBlankPost: config.errOnBlankPost ?? true,
  };

  // Log every incoming request
  if (opts.logIncoming) {
    http.use((req, res, next) => {
      const log = logger(d.logger, req, res);
      log.info(`Request received`);
      next();
    });
  }

  // Parse incoming bodies (JSON only)
  if (opts.parseJson) {
    http.use(Parsers.json({ type: opts.jsonMimeTypes }));
  }

  // If it's a post or a patch and the body isn't set, make sure the user passed the right
  // content-type header
  if (opts.errOnBlankPost) {
    http.use((req, res, next) => {
      if (
        ["post", "patch"].includes(req.method.toLowerCase()) &&
        Object.keys(req.body).length === 0
      ) {
        next(
          new E.BadRequest(
            "The body of your request is blank or does not appear to have been parsed correctly. " +
              "Please be sure to pass a content-type header specifying the content type of your body."
          )
        );
      } else {
        next();
      }
    });
  }

  // If we've explicitly requested the next features and we can't offer them, we need to throw an
  // error
  if (
    !d.svc &&
    (config.handleErrors === true ||
      config.handleFallthrough === true ||
      config.listenOnReady === true)
  ) {
    throw new E.InternalServerError(
      `You've requested error handling, fallthrough handling, or 'listen-on-ready', but you ` +
        `haven't provided a service manager that would enable this functionality. Please either ` +
        `change your config or add 'Weenie.serviceManager' to your dependencies to facilitate ` +
        `this. If you add 'Weenie.serviceManager', please note that you must call ` +
        `'svc.initialized(true)' when your service is fully connected.`
    );
  }

  // If svc manager available, add auto-listening on initialization
  let tcpListeners: Array<{ close(): unknown }> = [];
  if (d.svc && (opts.handleErrors || opts.handleFallthrough || opts.listenOnReady)) {
    const ready = getWithFallback<Promise<void>>(d.svc, "ready", "initTimeout");
    ready.then(() => {
      // Add fallthrough handling, if requested
      if (opts.handleFallthrough) {
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
      if (opts.handleErrors) {
        d.logger.debug(`Registering standard error handler`);
        http.catch(StandardErrorHandler(d.logger, opts));
      }

      // Start listening, saving the returned listeners
      if (opts.listenOnReady) {
        tcpListeners = http.listen();
      }
    });
  }

  return {
    http,
    // 2021-04-07: This must be a function because if not, the variable reference gets lost somewhere
    getTcpListeners: () => tcpListeners,
  };
}

const getWithFallback = <T>(d: any, k1: string, k2: string): T => d[k1] || d[k2];

export const StandardErrorHandler = (
  _log: SimpleLoggerInterface,
  opts: { mask500Errors: boolean | string }
): SimpleHttpServerErrorHandler => {
  return (e, req, res, next) => {
    const log = logger(_log, req, res);

    // Save original in case it's a JSON-RPC request
    const originalError = e;

    if (!E.isHttpError(e)) {
      const stack = e.stack;
      e = E.InternalServerError.fromError(e);
      e.stack = stack;
    }

    // Mask 500 errors, if requested
    const msg =
      opts.mask500Errors && e.status >= 500
        ? typeof opts.mask500Errors === "string"
          ? opts.mask500Errors
          : `Sorry, something went wrong on our end :(. Please try again.`
        : e.message;

    const level = <keyof SimpleLogLevels>(e.loglevel ? e.loglevel : "error");
    log[level](
      `Exception thrown: ${e.name} (${e.status}: ` +
        `'${e.subcode! || e.code!}') ${e.message}` +
        (e.obstructions?.length ? ` Obstructions:\n${JSON.stringify(e.obstructions, null, 2)}` : "")
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
            message: msg,
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
          detail: msg,
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
