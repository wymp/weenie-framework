import { SimpleLoggerInterface, SimpleLogLevels } from "ts-simple-interfaces";

export class TaggedLogger implements SimpleLoggerInterface {
  public constructor(protected header: string, protected logger: SimpleLoggerInterface) {}

  public log(
    level: keyof SimpleLogLevels,
    msg: string,
    ...meta: Array<any>
  ): SimpleLoggerInterface {
    return this.logger.log(level, `${this.header} ${msg}`, ...meta);
  }

  public debug(msg: string, ...meta: Array<any>) {
    return this.logger.debug(`${this.header} ${msg}`, ...meta);
  }

  public info(msg: string, ...meta: Array<any>) {
    return this.logger.info(`${this.header} ${msg}`, ...meta);
  }

  public notice(msg: string, ...meta: Array<any>) {
    return this.logger.notice(`${this.header} ${msg}`, ...meta);
  }

  public warning(msg: string, ...meta: Array<any>) {
    return this.logger.warning(`${this.header} ${msg}`, ...meta);
  }

  public error(msg: string, ...meta: Array<any>) {
    return this.logger.error(`${this.header} ${msg}`, ...meta);
  }

  public alert(msg: string, ...meta: Array<any>) {
    return this.logger.alert(`${this.header} ${msg}`, ...meta);
  }

  public critical(msg: string, ...meta: Array<any>) {
    return this.logger.critical(`${this.header} ${msg}`, ...meta);
  }

  public emergency(msg: string, ...meta: Array<any>) {
    return this.logger.emergency(`${this.header} ${msg}`, ...meta);
  }
}
