import { SimpleLoggerInterface, SimplePubSubInterface } from "@wymp/ts-simple-interfaces";
import {
  SimpleAmqpConfig,
  AbstractPubSubAmqp,
  Backoff,
  SubscriptionOptions,
  PublishOptions,
  SimpleAmqpMessage,
} from "@wymp/simple-pubsub-amqp";

export const amqp = (r: {
  config: { amqp: SimpleAmqpConfig };
  logger: SimpleLoggerInterface;
  backoff?: Backoff;
}) => {
  const pubsub = new WeeniePubSubAmqp(r.config.amqp, r.logger, { backoff: r.backoff });
  pubsub.connect();
  return { pubsub };
};

/**
 * Need to create an adapter class to change the signature of subscribe and publish for our specific
 * philosophy.
 */
export class WeeniePubSubAmqp extends AbstractPubSubAmqp
  implements
    SimplePubSubInterface<WeenieAmqpMessage, unknown, SubscriptionOptions, PublishOptions> {
  public subscribe(
    routes: { [exchange: string]: Array<string> },
    handler: (msg: WeenieAmqpMessage, log: SimpleLoggerInterface) => Promise<boolean>,
    options: SubscriptionOptions
  ): Promise<void> {
    return this.driver.subscribe(
      routes,
      async (_msg: SimpleAmqpMessage, log: SimpleLoggerInterface) => {
        let msg: any;
        try {
          msg = JSON.parse(_msg.content.toString("utf8"));
          if (msg === null || typeof msg !== "object") {
            throw new Error(
              `Message must be a non-null JSON object. Your message is ${
                msg === null ? "null" : `a(n) ${typeof msg}`
              }`
            );
          }
        } catch (e) {
          log.error(
            `Message body is not valid JSON: Message body: ${_msg.content.toString("utf8")}; ` +
              `Error: ${e.stack}`
          );
          // Have to return true here since this message will never parse correctly
          return true;
        }

        try {
          const m = {
            id: _msg.extra.messageId,
            timestamp: _msg.extra.timestamp,
            ...msg,
          };
          return await handler(m, log);
        } catch (e) {
          log.error(`Error executing handler: ${e.stack}`);
          return false;
        }
      },
      options
    );
  }

  public async publish(channel: string, msg: unknown, options: PublishOptions): Promise<void> {
    return this.driver.publish(channel, msg, options);
  }
}

declare interface WeenieAmqpMessage {
  id: string;
  timestamp: number;
  [k: string]: unknown;
}
