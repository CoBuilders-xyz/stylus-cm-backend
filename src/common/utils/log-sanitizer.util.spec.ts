import { ethers } from 'ethers';
import {
  REDACTED,
  maskBearerTokens,
  maskSecretPairs,
  redactUrls,
  sanitizeForLog,
  sanitizeStackForLog,
  sanitizeText,
} from './log-sanitizer.util';

// Obviously fake fixtures. Never paste real URLs, keys or tokens here.
const FAKE_HTTPS_URL = 'https://arb-mainnet.g.alchemy.com/v2/FAKEKEY';
const FAKE_WSS_URL = 'wss://arb-mainnet.g.alchemy.com/v2/FAKEKEY';
const FAKE_ETHERS_MESSAGE =
  'exceeded maximum retry limit (request={  }, response={  }, error=null, ' +
  `info={ "requestUrl": "${FAKE_HTTPS_URL}", "responseBody": null, ` +
  '"responseStatus": "429 Too Many Requests" }, code=UNKNOWN_ERROR, version=6.13.5)';

describe('log-sanitizer.util', () => {
  describe('redactUrls', () => {
    it('keeps scheme and host of an https URL and redacts the key path', () => {
      expect(redactUrls(`Error calling ${FAKE_HTTPS_URL} failed`)).toBe(
        `Error calling https://arb-mainnet.g.alchemy.com/${REDACTED} failed`,
      );
    });

    it('redacts a wss URL the same way', () => {
      expect(redactUrls(FAKE_WSS_URL)).toBe(
        `wss://arb-mainnet.g.alchemy.com/${REDACTED}`,
      );
    });

    it('redacts http and ws URLs with ports', () => {
      expect(redactUrls('http://localhost:8545/FAKEKEY')).toBe(
        `http://localhost:8545/${REDACTED}`,
      );
      expect(redactUrls('ws://127.0.0.1:8546/ws/FAKEKEY')).toBe(
        `ws://127.0.0.1:8546/${REDACTED}`,
      );
    });

    it('redacts every URL in a text, including the ethers info JSON', () => {
      const result = redactUrls(FAKE_ETHERS_MESSAGE);
      expect(result).not.toContain('FAKEKEY');
      expect(result).not.toContain('/v2/');
      expect(result).toContain(
        `"requestUrl": "https://arb-mainnet.g.alchemy.com/${REDACTED}"`,
      );
      expect(result).toContain('"responseStatus": "429 Too Many Requests"');
    });

    it('redacts query strings and fragments', () => {
      expect(redactUrls('https://rpc.example.com?apiKey=FAKEKEY')).toBe(
        `https://rpc.example.com/${REDACTED}`,
      );
      expect(redactUrls('https://rpc.example.com/#FAKEKEY')).toBe(
        `https://rpc.example.com/${REDACTED}`,
      );
    });

    it('keeps trailing punctuation outside the redaction', () => {
      expect(redactUrls(`(url=${FAKE_HTTPS_URL}, code=X).`)).toBe(
        `(url=https://arb-mainnet.g.alchemy.com/${REDACTED}, code=X).`,
      );
    });

    it('drops userinfo even when there is no path', () => {
      expect(redactUrls('https://user:FAKEPASS@rpc.example.com')).toBe(
        'https://rpc.example.com',
      );
      expect(
        redactUrls('https://user:FAKEPASS@rpc.example.com/v2/FAKEKEY'),
      ).toBe(`https://rpc.example.com/${REDACTED}`);
    });

    it('leaves URLs without a path unchanged', () => {
      expect(redactUrls('Application is running on: http://[::]:3000')).toBe(
        'Application is running on: http://[::]:3000',
      );
      expect(redactUrls('Frontend URL: https://app.example.com')).toBe(
        'Frontend URL: https://app.example.com',
      );
      expect(redactUrls('https://app.example.com/')).toBe(
        'https://app.example.com/',
      );
    });

    it('is idempotent', () => {
      const once = redactUrls(FAKE_ETHERS_MESSAGE);
      expect(redactUrls(once)).toBe(once);
    });
  });

  describe('maskBearerTokens', () => {
    it('masks the token after Bearer and keeps the casing of the word', () => {
      expect(maskBearerTokens('Authorization: Bearer FAKE.TOKEN-123')).toBe(
        `Authorization: Bearer ${REDACTED}`,
      );
      expect(maskBearerTokens('authorization: bearer FAKETOKEN, x')).toBe(
        `authorization: bearer ${REDACTED}, x`,
      );
    });

    it('is idempotent', () => {
      const once = maskBearerTokens('Bearer FAKETOKEN');
      expect(maskBearerTokens(once)).toBe(once);
    });
  });

  describe('maskSecretPairs', () => {
    it.each([
      ['apiKey=FAKEKEY&foo=bar', `apiKey=${REDACTED}&foo=bar`],
      ['api_key=FAKEKEY', `api_key=${REDACTED}`],
      ['access_token=FAKETOKEN', `access_token=${REDACTED}`],
      ['token=FAKETOKEN', `token=${REDACTED}`],
      ['key=FAKEKEY', `key=${REDACTED}`],
      ['x-api-key: FAKEKEY', `x-api-key: ${REDACTED}`],
      ['"accessToken": "FAKETOKEN"', `"accessToken": "${REDACTED}"`],
      ["'password': 'FAKEPASS'", `'password': '${REDACTED}'`],
    ])('masks %s', (input, expected) => {
      expect(maskSecretPairs(input)).toBe(expected);
    });

    it('keeps unquoted scalars and object or array values (valid JSON)', () => {
      const unchanged = [
        '{"key":123,"token":null,"secret":true,"apiKey":{"nested":1},"keys":[1]}',
        '{ key: 123, token: null, apiKey: { nested: 1 }, list: [ 1 ] }',
        'key=42 token=-1.5 enabled=false',
        '"password": undefined',
      ];
      for (const text of unchanged) {
        expect(maskSecretPairs(text)).toBe(text);
      }
      // Quoted scalars are strings and may be secrets.
      expect(maskSecretPairs('{"key":"123"}')).toBe(`{"key":"${REDACTED}"}`);
      expect(maskSecretPairs('apiKey=123456:FAKE')).toBe(`apiKey=${REDACTED}`);
      expect(JSON.parse(maskSecretPairs('{"key":123,"token":"FAKE"}'))).toEqual(
        {
          key: 123,
          token: REDACTED,
        },
      );
    });

    it('leaves non-secret pairs and prose unchanged', () => {
      const text =
        'code=UNKNOWN_ERROR, version=6.13.5, "responseStatus": "429", ' +
        'Registered fast sync access token for chainId 42161, ' +
        'Token valid but user not found: 0xabc, Marked event as processing: evt-1';
      expect(maskSecretPairs(text)).toBe(text);
    });
  });

  describe('sanitizeText', () => {
    it('applies URL, bearer and pair masking together', () => {
      const text = `url=${FAKE_HTTPS_URL} Bearer FAKETOKEN apiKey=FAKEKEY`;
      expect(sanitizeText(text)).toBe(
        `url=https://arb-mainnet.g.alchemy.com/${REDACTED} Bearer ${REDACTED} apiKey=${REDACTED}`,
      );
    });

    it('returns ordinary messages byte-for-byte', () => {
      const messages = [
        'Application is running on: http://[::]:3000',
        'Contract state fetched for blockchain abc: 12 contracts, queue 3/10, block 123',
        'Error calling queryFilter on contract 0xabc (attempt 1/4): boom',
        'Pinging WebSocket provider for blockchain Arbitrum One (state: OPEN)',
        'Registered fast sync access token for chainId 42161',
        '',
      ];
      for (const message of messages) {
        expect(sanitizeText(message)).toBe(message);
      }
    });
  });

  describe('sanitizeForLog', () => {
    it('prefers shortMessage, code and status for ethers errors', () => {
      const error = ethers.makeError(
        'exceeded maximum retry limit',
        'UNKNOWN_ERROR',
        {
          request: {},
          response: {},
          error: null,
          info: {
            requestUrl: FAKE_HTTPS_URL,
            responseBody: null,
            responseStatus: '429 Too Many Requests',
          },
        },
      );
      // ethers puts the full URL in the message; the sanitized text must not.
      expect(error.message).toContain('FAKEKEY');

      const result = sanitizeForLog(error);
      expect(result).toBe(
        'exceeded maximum retry limit (code=UNKNOWN_ERROR, status=429 Too Many Requests)',
      );
      expect(result).not.toContain('FAKEKEY');
    });

    it('still sanitizes a shortMessage that embeds a URL', () => {
      const error = Object.assign(new Error('x'), {
        shortMessage: `could not reach ${FAKE_HTTPS_URL}`,
        code: 'NETWORK_ERROR',
      });
      expect(sanitizeForLog(error)).toBe(
        `could not reach https://arb-mainnet.g.alchemy.com/${REDACTED} (code=NETWORK_ERROR)`,
      );
    });

    it('falls back to the sanitized full message for plain errors', () => {
      expect(sanitizeForLog(new Error(FAKE_ETHERS_MESSAGE))).not.toContain(
        'FAKEKEY',
      );
      expect(sanitizeForLog(new Error('boom'))).toBe('boom');
      expect(sanitizeForLog(new TypeError('x is not a function'))).toBe(
        'x is not a function',
      );
    });

    it('sanitizes strings', () => {
      expect(sanitizeForLog(FAKE_ETHERS_MESSAGE)).not.toContain('FAKEKEY');
      expect(sanitizeForLog('plain text')).toBe('plain text');
    });

    it('stringifies non-Error, non-string input like String()', () => {
      expect(sanitizeForLog(42)).toBe('42');
      expect(sanitizeForLog(null)).toBe('null');
      expect(sanitizeForLog(undefined)).toBe('undefined');
      expect(sanitizeForLog({ a: 1 })).toBe('[object Object]');
      expect(sanitizeForLog(Object.create(null))).toBe(
        '[unserializable value]',
      );
    });
  });

  describe('sanitizeStackForLog', () => {
    it('sanitizes the stack of an Error', () => {
      const error = new Error(FAKE_ETHERS_MESSAGE);
      const stack = sanitizeStackForLog(error);
      expect(stack).toBeDefined();
      expect(stack).not.toContain('FAKEKEY');
      expect(stack).toMatch(/^Error: exceeded maximum retry limit/);
      expect(stack).toMatch(/\n\s+at /);
    });

    it('returns undefined for non-Error values or errors without stack', () => {
      expect(sanitizeStackForLog('text')).toBeUndefined();
      expect(sanitizeStackForLog(undefined)).toBeUndefined();
      const noStack = new Error('x');
      noStack.stack = undefined;
      expect(sanitizeStackForLog(noStack)).toBeUndefined();
    });
  });

  describe('escaped JSON and ANSI color codes', () => {
    it('masks pairs and URLs inside escaped JSON (responseBody serialized into a message)', () => {
      const text =
        'info={ "responseBody": "{\\"apiKey\\":\\"FAKEKEY\\",\\"url\\":\\"https://rpc.example.com/v2/FAKEKEY\\"}" }';
      const result = sanitizeText(text);
      expect(result).not.toContain('FAKEKEY');
      expect(result).toContain(`\\"apiKey\\":\\"${REDACTED}\\"`);
      expect(result).toContain(`https://rpc.example.com/${REDACTED}\\"`);
    });

    it('masks escaped bearer headers', () => {
      const result = sanitizeText(
        '{\\"authorization\\":\\"Bearer FAKETOKEN\\"}',
      );
      expect(result).not.toContain('FAKETOKEN');
      expect(result).toContain(`Bearer ${REDACTED}`);
    });

    it('masks escaped JSON inside a stack trace', () => {
      const error = new Error('request failed: {\\"apiKey\\":\\"FAKEKEY\\"}');
      expect(sanitizeStackForLog(error)).not.toContain('FAKEKEY');
    });

    it('masks values wrapped in util.inspect color codes and keeps the reset', () => {
      expect(sanitizeText("{ apiKey: \x1b[32m'FAKEKEY'\x1b[39m }")).toBe(
        `{ apiKey: \x1b[32m'${REDACTED}'\x1b[39m }`,
      );
      expect(sanitizeText('\x1b[31mapiKey=FAKEKEY\x1b[39m')).toBe(
        `\x1b[31mapiKey=${REDACTED}\x1b[39m`,
      );
      expect(sanitizeText(`\x1b[31mBearer FAKETOKEN\x1b[39m`)).toBe(
        `\x1b[31mBearer ${REDACTED}\x1b[39m`,
      );
      expect(sanitizeText(`\x1b[31m${FAKE_HTTPS_URL}\x1b[39m`)).toBe(
        `\x1b[31mhttps://arb-mainnet.g.alchemy.com/${REDACTED}\x1b[39m`,
      );
    });
  });
});
