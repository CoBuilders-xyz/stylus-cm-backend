import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { sanitizeText } from './log-sanitizer.util';

type JsonPrintOptions = {
  context: string;
  logLevel: LogLevel;
  writeStreamType?: 'stdout' | 'stderr';
  errorStack?: unknown;
};

// The three protected ConsoleLogger methods that turn a log call into bytes.
type ConsoleLoggerInternals = {
  formatMessage: (
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ) => string;
  printStackTrace: (stack: string) => void;
  printAsJson: (message: unknown, options: JsonPrintOptions) => void;
};

const INSTALLED = Symbol.for('stylus-cm-backend.log-sanitizer.installed');

type WriteFn = (
  this: NodeJS.WriteStream,
  chunk: unknown,
  ...rest: unknown[]
) => boolean;

/**
 * Runs `fn` while every string written to `stream` is sanitized first.
 * `fn` must be synchronous; the original `write` is restored before return.
 */
function withSanitizedWrites(stream: NodeJS.WriteStream, fn: () => void): void {
  const hadOwnWrite =
    Object.getOwnPropertyDescriptor(stream, 'write') !== undefined;
  const originalWrite = Reflect.get(stream, 'write') as WriteFn;
  const sanitizedWrite: WriteFn = function (chunk, ...rest) {
    const data = typeof chunk === 'string' ? sanitizeText(chunk) : chunk;
    return originalWrite.call(this, data, ...rest) as boolean;
  };
  Reflect.set(stream, 'write', sanitizedWrite);
  try {
    fn();
  } finally {
    if (hadOwnWrite) {
      Reflect.set(stream, 'write', originalWrite);
    } else {
      Reflect.deleteProperty(stream, 'write');
    }
  }
}

/**
 * Wraps the ConsoleLogger methods that write a formatted line, a stack trace
 * or a JSON payload so that every log line of the process is sanitized right
 * before it is written. Defense in depth for log sites that hand an Error
 * object, a nested object or an unsanitized message to the logger.
 *
 * Only the rendered text is sanitized; the values passed to the logger are
 * never walked or copied, so getters, class instances, Maps and Error
 * properties are rendered exactly as ConsoleLogger renders them.
 *
 * The prototype is patched instead of installing a custom logger instance so
 * that Nest keeps creating one ConsoleLogger per `Logger`, and per-instance
 * options such as the `timestamp: true` used by Nest's own boot messages keep
 * working byte-for-byte (see the spec).
 *
 * Returns true when this call applied the patch and false when it was already
 * installed. Throws when the ConsoleLogger internals are not the expected
 * ones, so a Nest upgrade cannot silently disable the sanitizer.
 */
export function installLogSanitizer(): boolean {
  const proto = ConsoleLogger.prototype as unknown as ConsoleLoggerInternals & {
    [INSTALLED]?: true;
  };
  if (proto[INSTALLED]) {
    return false;
  }

  const originalFormatMessage = proto.formatMessage;
  const originalPrintStackTrace = proto.printStackTrace;
  const originalPrintAsJson = proto.printAsJson;
  if (
    typeof originalFormatMessage !== 'function' ||
    typeof originalPrintStackTrace !== 'function' ||
    typeof originalPrintAsJson !== 'function'
  ) {
    throw new Error(
      'installLogSanitizer: ConsoleLogger internals changed, update log-sanitizer-install.util.ts',
    );
  }

  proto.formatMessage = function (
    this: ConsoleLogger,
    logLevel,
    message,
    pidMessage,
    formattedLogLevel,
    contextMessage,
    timestampDiff,
  ): string {
    const line = originalFormatMessage.call(
      this,
      logLevel,
      message,
      pidMessage,
      formattedLogLevel,
      contextMessage,
      timestampDiff,
    ) as string;
    return sanitizeText(line);
  };

  proto.printStackTrace = function (this: ConsoleLogger, stack): void {
    originalPrintStackTrace.call(
      this,
      typeof stack === 'string' ? sanitizeText(stack) : stack,
    );
  };

  proto.printAsJson = function (this: ConsoleLogger, message, options): void {
    const stream =
      options?.writeStreamType === 'stderr' ? process.stderr : process.stdout;
    withSanitizedWrites(stream, () => {
      originalPrintAsJson.call(this, message, options);
    });
  };

  proto[INSTALLED] = true;
  return true;
}
