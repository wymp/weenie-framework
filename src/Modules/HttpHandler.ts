import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import { WebServiceConfig } from "@wymp/weenie-base";
import { SimpleHttpServerExpress } from "@wymp/simple-http-server-express";

export function httpHandler(d: {
  config: { webservice: WebServiceConfig };
  logger: SimpleLoggerInterface;
}) {
  const http = new SimpleHttpServerExpress(d.config.webservice, d.logger);

  // Log every incoming request
  http.use((req, res, next) => {
    d.logger.info(`${req.method} ${req.path}`);
    next();
  });

  return { http };
}
