import { SimpleHttpClientRpn, SimpleRpnRequestConfig } from "simple-http-client-rpn";
import {
  SimpleHttpClientInterface,
  SimpleHttpClientResponseInterface,
  SimpleLoggerInterface,
} from "ts-simple-interfaces";
import { ApiConfig } from "weenie-base";

/**
 * *WIP*
 *
 * At the time of this writing, there is no good way to pull this off. We may have to resort to
 * depending on runtime type checking.
 *
 * Intended use:
 *
 * ...
 * .and(api("api"))
 * .and(api("secondaryApi"))
 * ...
 *
 * This works for the first case, but not for the second, because the `configKey` pamater is typed
 * as the literal, "api", which then denies the incoming "secondaryApi" string. Using type
 * parameters seems like it should work, but you're not allowed to use dynamic types as key
 * references for an object.
 */

export function api(
  configKey: "api" = "api"
): (d: { config: { envType: string; [configKey]: ApiConfig; }; logger: SimpleLoggerInterface; }) => {
  [configKey]: SimpleHttpClientInterface
} {
  return (d: { config: { envType: string; [configKey]: ApiConfig; }; logger: SimpleLoggerInterface; }) => {
    const config = d.config;
    const apiConfig = config[configKey];
    const rpn = new SimpleHttpClientRpn({}, d.logger);
    const authString = `Basic ` +
      new Buffer(`${apiConfig.key}:${apiConfig.secret}`).toString("base64");

    return {
      [configKey]: <SimpleHttpClientInterface>{
        request: <D extends any>(
          req: SimpleRpnRequestConfig
        ): Promise<SimpleHttpClientResponseInterface<D>> => {
          if (config.envType === "dev") {
            req.rejectUnauthorized = false;
          }
          req.baseURL = apiConfig.baseUrl;

          if (!req.method) {
            req.method = "GET";
          }

          function has(header: string) {
            return Object.keys(req.headers!).find(k => k.toLowerCase() === header) !== undefined;
          }

          if (!req.headers) {
            req.headers = {};
          }
          if (!has("authorization")) {
            req.headers["Authorization"] = authString;
          } else {
            req.headers["Authorization"] += `, ${authString}`;
          }
          if (!has("accept")) {
            req.headers["Accept"] = "application/json";
          }
          if (req.method !== "GET" && !has("content-type")) {
            req.headers["Content-Type"] = "application/json";
          }

          d.logger.info(`Making API call to ${req.method} ${req.baseURL}${req.url}`);
          d.logger.debug(`Full request options:\n${JSON.stringify(req, null, 2)}`);

          return rpn.request<D>(req);
        }
      }
    }
  };
}

