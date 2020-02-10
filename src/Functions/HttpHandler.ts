import * as express from "express";
import {
  SimpleHttpRequestHandlerInterface,
  SimpleHttpServerMiddleware,
  SimpleHttpServerNextFunction,
  SimpleLoggerInterface,
} from "ts-simple-interfaces";
import { WebServiceConfig } from "weenie-base";

export function httpHandler(d: {
    config: { webservice: WebServiceConfig; },
    logger: SimpleLoggerInterface,
  }
) {
  return {
    http: new SimpleHttpServer(d.config.webservice, d.logger),
  }
}

export class SimpleHttpServer implements SimpleHttpRequestHandlerInterface {
  protected app: express.Express;

  public constructor(
    protected config: WebServiceConfig,
    protected log: SimpleLoggerInterface,
  ) {
    this.app = express();
  }

  public use(middlewareOrErrorHandler: SimpleHttpServerMiddleware | SimpleHttpServerNextFunction): SimpleHttpRequestHandlerInterface {
    this.app.use(<any>middlewareOrErrorHandler);
    return this;
  }

  public get<P, ResBody, Query>(route: string | RegExp, handler: SimpleHttpServerMiddleware): SimpleHttpRequestHandlerInterface {
    this.app.get(route, <express.RequestHandler>handler);
    return this;
  }

  public post(route: string | RegExp, handler: SimpleHttpServerMiddleware): SimpleHttpRequestHandlerInterface {
    this.app.post(route, <express.RequestHandler>handler);
    return this;
  }

  public patch(route: string | RegExp, handler: SimpleHttpServerMiddleware): SimpleHttpRequestHandlerInterface {
    this.app.patch(route, <express.RequestHandler>handler);
    return this;
  }

  public put(route: string | RegExp, handler: SimpleHttpServerMiddleware): SimpleHttpRequestHandlerInterface {
    this.app.put(route, <express.RequestHandler>handler);
    return this;
  }

  public delete(route: string | RegExp, handler: SimpleHttpServerMiddleware): SimpleHttpRequestHandlerInterface {
    this.app.delete(route, <express.RequestHandler>handler);
    return this;
  }

  public head(route: string | RegExp, handler: SimpleHttpServerMiddleware): SimpleHttpRequestHandlerInterface {
    this.app.head(route, <express.RequestHandler>handler);
    return this;
  }

  public options(route: string | RegExp, handler: SimpleHttpServerMiddleware): SimpleHttpRequestHandlerInterface {
    this.app.options(route, <express.RequestHandler>handler);
    return this;
  }

  public listen(userCallback?: (...args: Array<unknown>) => unknown): void {
    if (this.config.listeners.length === 0) {
      this.log.error(`You've called 'listen', but you haven't passed any listeners in your config.`);
    } else {
      this.config.listeners.map((listener) => {
        const internalCallback = (...args: Array<unknown>) => {
          this.log.notice(`Listening on ${listener[1] ? `${listener[1]}:${listener[0]}` : `Port ${listener[0]}`}`);
          if (userCallback) {
            userCallback(...args);
          }
        }
        if (listener[1]) {
          this.app.listen(listener[0], listener[1], internalCallback);
        } else {
          this.app.listen(listener[0], internalCallback);
        }
      });
    }
  }
}
