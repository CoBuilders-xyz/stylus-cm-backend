import { ConsoleLogger, Logger, LogLevel } from '@nestjs/common';
import { installLogSanitizer } from './log-sanitizer-install.util';
import { REDACTED } from './log-sanitizer.util';

// Obviously fake fixtures. Never paste real URLs, keys or tokens here.
const FAKE_URL = 'https://arb-mainnet.g.alchemy.com/v2/FAKEKEY';
const FAKE_ETHERS_MESSAGE =
  'exceeded maximum retry limit (request={  }, response={  }, error=null, ' +
  `info={ "requestUrl": "${FAKE_URL}", "responseBody": null }, ` +
  'code=UNKNOWN_ERROR, version=6.13.5)';
const ALL_LEVELS: LogLevel[] = [
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
  'fatal',
];
// Built once: a stack created inside writeNormalLines would differ between
// the two captures by the line number of the call site.
const BOOM_STACK = new Error('boom').stack;
const NORMAL_MESSAGES = [
  'Application is running on: http://[::]:3000',
  'Frontend URL: https://app.example.com',
  'Contract state fetched for blockchain abc: 12 contracts, queue 3/10, block 123',
  'Registered fast sync access token for chainId 42161',
  'Error calling queryFilter on contract 0xabc (attempt 1/4): boom',
];

class Point {
  x = 1;
  y = 2;
}

// Values whose rendering must not change: props, getters, Maps, classes.
// Built once so the Error stack is identical in both captures.
const NORMAL_OBJECTS: unknown[] = [
  { blockchain: 'abc', count: 3, nested: { ok: true } },
  Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
    code: 'ECONNREFUSED',
    port: 5432,
  }),
  {
    get lazy() {
      return 'computed';
    },
  },
  new Map([['chain', 42161]]),
  new Point(),
  { toJSON: () => ({ chain: 'abc' }) },
  // Secret-looking keys with non-string values must render unchanged.
  { key: 123, token: null, secret: true, apiKey: { nested: 1 }, keys: [1] },
];

/** Runs fn and returns everything it wrote to stdout and stderr, in order. */
function capture(fn: () => void): string[] {
  const out: string[] = [];
  const record = (chunk: string | Uint8Array) => {
    out.push(String(chunk));
    return true;
  };
  const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(record);
  const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(record);
  try {
    fn();
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
  return out;
}

/** The lines Nest and the app write in a normal run, through every path. */
function writeNormalLines(): void {
  const direct = new ConsoleLogger({ logLevels: ALL_LEVELS });
  const jsonCompact = new ConsoleLogger({
    json: true,
    colors: false,
    logLevels: ALL_LEVELS,
  });
  const jsonColored = new ConsoleLogger({
    json: true,
    colors: true,
    logLevels: ALL_LEVELS,
  });

  for (const logger of [direct, jsonCompact, jsonColored]) {
    for (const level of ALL_LEVELS) {
      for (const message of NORMAL_MESSAGES) {
        logger[level](message, 'Bootstrap');
      }
    }
    logger.error('Failed to start application: boom', BOOM_STACK, 'Bootstrap');
    for (const value of NORMAL_OBJECTS) {
      logger.log(value, 'Ctx');
    }
  }

  // Nest core creates its boot loggers like this; the +Nms suffix comes from
  // the per-instance timestamp option.
  const nestBoot = new Logger('InstanceLoader', { timestamp: true });
  nestBoot.log('TypeOrmModule dependencies initialized');
  nestBoot.log('EventFetcherModule dependencies initialized');
  const app = new Logger('EventFetcher - ContractCall');
  app.error('Error calling queryFilter on contract 0xabc (attempt 1/4): boom');
  app.warn('Using fallback value for queryFilter after 4 failed attempts');
}

describe('installLogSanitizer', () => {
  beforeEach(() => {
    // Undo the Logger.prototype mocks from jest.setup.ts: these tests need the
    // real Logger -> ConsoleLogger -> stream path.
    jest.restoreAllMocks();
    // Freeze time so timestamps and +Nms diffs are identical across runs.
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps ordinary lines byte-for-byte, including per-instance +Nms timestamps and JSON mode', () => {
    // Warm up the static timestamp so both runs start from the same state.
    capture(() => new ConsoleLogger().log('warm up'));
    const before = capture(writeNormalLines);
    const joined = before.join('');
    expect(joined).toContain('+0ms');
    expect(joined).toContain('[InstanceLoader]');
    expect(joined).toContain('\n    at ');
    expect(joined).toContain("code: 'ECONNREFUSED'"); // Error props rendered
    expect(joined).toContain('[Getter]');
    expect(joined).toContain('"key":123,"token":null'); // compact JSON branch
    expect(joined).toContain('\x1b['); // colored JSON branch really colors

    expect(installLogSanitizer()).toBe(true);

    capture(() => new ConsoleLogger().log('warm up'));
    const after = capture(writeNormalLines);
    expect(after).toEqual(before);
  });

  it('is idempotent', () => {
    installLogSanitizer();
    expect(installLogSanitizer()).toBe(false);
  });

  it('restores the stream write after a JSON line, even when rendering throws', () => {
    installLogSanitizer();
    const json = new ConsoleLogger({
      json: true,
      colors: false,
      logLevels: ALL_LEVELS,
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const originalWrite: unknown = Reflect.get(process.stdout, 'write');
    expect(() => json.log(circular, 'Ctx')).toThrow();
    expect(Reflect.get(process.stdout, 'write')).toBe(originalWrite);
    expect(capture(() => json.log('still fine', 'Ctx')).join('')).toContain(
      'still fine',
    );
  });

  it('redacts the message and the stack of a line written through Nest Logger', () => {
    installLogSanitizer();
    const logger = new Logger('EventFetcher - ContractCall');

    const out = capture(() => {
      logger.error(
        `Error calling queryFilter (attempt 1/4): ${FAKE_ETHERS_MESSAGE}`,
        new Error(FAKE_ETHERS_MESSAGE).stack,
      );
      logger.log('Successfully reconnected to blockchain abc');
    }).join('');

    expect(out).not.toContain('FAKEKEY');
    expect(out).not.toContain('/v2/');
    expect(out).toContain(`arb-mainnet.g.alchemy.com/${REDACTED}`);
    expect(out).toContain('[EventFetcher - ContractCall]');
    expect(out).toContain('\n    at ');
    expect(out).toContain('Successfully reconnected to blockchain abc');
  });

  it('redacts Error objects passed as message or as extra parameter', () => {
    installLogSanitizer();
    const logger = new Logger('UserContracts');
    const error = Object.assign(new Error(FAKE_ETHERS_MESSAGE), {
      info: { requestUrl: FAKE_URL },
    });

    const out = capture(() => {
      logger.error(error);
      logger.error('Failed to create user contract', error);
    }).join('');

    expect(out).not.toContain('FAKEKEY');
    expect(out).toContain('exceeded maximum retry limit');
  });

  it('redacts secret fields of colored object output and keeps the color reset', () => {
    installLogSanitizer();
    const colored = new ConsoleLogger({ colors: true, logLevels: ALL_LEVELS });

    const out = capture(() =>
      colored.error(
        {
          apiKey: 'FAKEKEY',
          requestUrl: FAKE_URL,
          headers: { authorization: 'Bearer FAKETOKEN' },
        },
        'Ctx',
      ),
    ).join('');

    expect(out).toContain('\x1b['); // colors really were on
    expect(out).not.toContain('FAKEKEY');
    expect(out).not.toContain('FAKETOKEN');
    expect(out).toContain(`'${REDACTED}'\x1b[39m`);
  });

  it('redacts rendered JSON lines: nested payloads, Error objects, stacks, classes and Maps', () => {
    installLogSanitizer();
    const jsonCompact = new ConsoleLogger({
      json: true,
      colors: false,
      logLevels: ALL_LEVELS,
    });
    const jsonColored = new ConsoleLogger({
      json: true,
      colors: true,
      logLevels: ALL_LEVELS,
    });
    const deep = {
      l1: {
        l2: {
          l3: {
            l4: {
              l5: {
                l6: {
                  l7: { l8: { l9: { token: 'FAKETOKEN', url: FAKE_URL } } },
                },
              },
            },
          },
        },
      },
    };
    const error = Object.assign(new Error(FAKE_ETHERS_MESSAGE), {
      code: 'UNKNOWN_ERROR',
      info: { requestUrl: FAKE_URL },
    });
    class Holder {
      url = FAKE_URL;
    }

    const lines = capture(() => {
      for (const json of [jsonCompact, jsonColored]) {
        json.error(
          FAKE_ETHERS_MESSAGE,
          new Error(FAKE_ETHERS_MESSAGE).stack,
          'Ctx',
        );
        json.warn(
          { requestUrl: FAKE_URL, nested: [{ token: 'FAKETOKEN' }] },
          'Ctx',
        );
        json.error(error, 'Ctx');
        json.log(deep, 'Ctx');
        json.log(new Holder(), 'Ctx');
        json.log(new Map([['url', FAKE_URL]]), 'Ctx');
        json.log({ toJSON: () => ({ url: FAKE_URL }) }, 'Ctx');
      }
    });

    expect(lines).toHaveLength(14);
    const joined = lines.join('');
    expect(lines[7]).toContain('\x1b['); // first colored-JSON line
    expect(joined).not.toContain('FAKEKEY');
    expect(joined).not.toContain('FAKETOKEN');
    expect(joined).toContain(`arb-mainnet.g.alchemy.com/${REDACTED}`);

    const first = JSON.parse(lines[0]) as {
      message: string;
      stack: string;
      context: string;
    };
    expect(first.context).toBe('Ctx');
    expect(first.message).toContain(`arb-mainnet.g.alchemy.com/${REDACTED}`);
    expect(first.stack).toMatch(/\n\s+at /);

    const second = JSON.parse(lines[1]) as {
      message: { requestUrl: string; nested: Array<{ token: string }> };
    };
    expect(second.message.requestUrl).toBe(
      `https://arb-mainnet.g.alchemy.com/${REDACTED}`,
    );
    expect(second.message.nested[0].token).toBe(REDACTED);

    // Error properties other than the URL are still rendered (S5).
    expect(lines[2]).toContain('UNKNOWN_ERROR');
  });
});
