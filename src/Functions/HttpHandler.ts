import { SimpleLoggerInterface } from "ts-simple-interfaces";
import { WebServiceConfig } from "weenie-base";
import { SimpleHttpServerExpress } from "simple-http-server-express";

export function httpHandler(d: {
  config: { webservice: WebServiceConfig };
  logger: SimpleLoggerInterface;
}) {
  const http = new SimpleHttpServerExpress(d.config.webservice, d.logger);

  // Log every incoming request
  http.use((req, res, next) => {
    d.logger.info(`${req.method} ${req.path}`);
  });

  return { http };
}
