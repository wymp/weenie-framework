import { SimpleHttpClientRpn, SimpleRpnRequestConfig } from "simple-http-client-rpn";
import {
  SimpleHttpClientInterface,
  SimpleHttpClientResponseInterface,
  SimpleLoggerInterface,
} from "ts-simple-interfaces";
import { ApiConfig } from "weenie-base";

/**
 * **NOTE:** Because it's possible to have more than one simple-conformant API client in an app,
 * it's hard to abstract instantiation of the API client completely away from the general app
 * setup, even though it's fairly standard. Thus, it was necessary to define this "BaseApiDeps"
 * type which is meant to be unified with a config dependency that defines the actual API clients
 * that are being configured.
 *
 * For example, when instantiating an app, you would do something like this:
 *
 * ....
 * .and((d: BaseApiDeps & { config: { firstApi: ApiConfig; secondApi: ApiConfig; } }) => {
 *   return {
 *     firstApi: new ApiClient({ envType: d.config.envType, ...d.config.firstApi }, d.logger),
 *     secondApi: new ApiClient({ envType: d.config.envType, ...d.config.secondApi }, d.logger),
 *   }
 * })
 *
 * This defines the config keys that you're going to be using for your api clients, then uses those
 * keys to create two distinct instances of the simple-conformant ApiClient class, one for each
 * api.
 */
export type BaseApiDeps = { config: { envType: string }; logger: SimpleLoggerInterface };

export class ApiClient implements SimpleHttpClientInterface {
  protected rpn: SimpleHttpClientInterface;
  protected authString: string;

  public constructor(
    protected config: { envType: string } & ApiConfig,
    protected log: SimpleLoggerInterface
  ) {
    this.rpn = new SimpleHttpClientRpn({}, this.log);
    this.authString =
      `Basic ` + new Buffer(`${this.config.key}:${this.config.secret}`).toString("base64");
  }

  public request<D extends any>(
    req: SimpleRpnRequestConfig
  ): Promise<SimpleHttpClientResponseInterface<D>> {
    if (this.config.envType === "dev") {
      req.rejectUnauthorized = false;
    }
    req.baseURL = this.config.baseUrl;

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
      req.headers["Authorization"] = this.authString;
    } else {
      req.headers["Authorization"] += `, ${this.authString}`;
    }
    if (!has("accept")) {
      req.headers["Accept"] = "application/json";
    }
    if (req.method !== "GET" && !has("content-type")) {
      req.headers["Content-Type"] = "application/json";
    }

    this.log.info(`Making API call to ${req.method} ${req.baseURL}${req.url}`);
    this.log.debug(`Full request options:\n${JSON.stringify(req, null, 2)}`);

    return this.rpn.request<D>(req);
  }
}
