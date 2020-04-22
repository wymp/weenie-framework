import { SimpleLoggerInterface } from "ts-simple-interfaces";
import {
  SimpleAmqpConfig,
  AbstractPubSubAmqp,
  Backoff,
  SubscriptionOptions,
  PublishOptions,
  SimpleAmqpMessage,
} from "simple-pubsub-amqp";

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
export class WeeniePubSubAmqp extends AbstractPubSubAmqp<
  WeenieAmqpMessage,
  unknown,
  SubscriptionOptions,
  PublishOptions
> {
  public subscribe(
    routes: { [exchange: string]: Array<string> },
    handler: (msg: WeenieAmqpMessage, log: SimpleLoggerInterface) => Promise<boolean>,
    options: SubscriptionOptions
  ): Promise<void> {
    return this.driver.subscribe(
      routes,
      (msg: SimpleAmqpMessage, log: SimpleLoggerInterface) => {
        const m = Object.assign(
          { id: msg.extra.messageId, timestamp: msg.extra.timestamp },
          JSON.parse(msg.content.toString("utf8"))
        );
        return handler(m, log);
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
