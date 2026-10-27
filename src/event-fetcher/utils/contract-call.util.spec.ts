import { Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { safeContractCall } from './contract-call.util';

// Obviously fake fixtures. Never paste real URLs, keys or tokens here.
const FAKE_URL = 'https://arb-mainnet.g.alchemy.com/v2/FAKEKEY';
const CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';

/** Builds the error ethers v6 throws when the RPC keeps answering 429. */
function makeProviderError(): Error {
  return ethers.makeError('exceeded maximum retry limit', 'UNKNOWN_ERROR', {
    request: {},
    response: {},
    error: null,
    info: {
      requestUrl: FAKE_URL,
      responseBody: null,
      responseStatus: '429 Too Many Requests',
    },
  });
}

function makeContract(queryFilter: jest.Mock): ethers.Contract {
  return {
    target: CONTRACT_ADDRESS,
    queryFilter,
  } as unknown as ethers.Contract;
}

describe('safeContractCall', () => {
  // jest.setup.ts replaces these with no-op mocks before every test;
  // jest.spyOn on an already mocked method returns that same mock.
  const errorSpy = () => jest.spyOn(Logger.prototype, 'error');
  const warnSpy = () => jest.spyOn(Logger.prototype, 'warn');
  const loggedErrors = () => errorSpy().mock.calls.map((c) => String(c[0]));

  it('returns the result on success without logging', async () => {
    const queryFilter = jest.fn().mockResolvedValue(['event']);

    await expect(
      safeContractCall(makeContract(queryFilter), 'queryFilter', ['Filter']),
    ).resolves.toEqual(['event']);

    expect(queryFilter).toHaveBeenCalledWith('Filter');
    expect(errorSpy()).not.toHaveBeenCalled();
    expect(warnSpy()).not.toHaveBeenCalled();
  });

  it('logs every attempt without the provider URL and rethrows the same error', async () => {
    const error = makeProviderError();
    expect(error.message).toContain('FAKEKEY'); // what ethers really produces
    const queryFilter = jest.fn().mockRejectedValue(error);

    await expect(
      safeContractCall(makeContract(queryFilter), 'queryFilter', ['Filter'], {
        retries: 3,
        retryDelay: 0,
      }),
    ).rejects.toBe(error);

    expect(queryFilter).toHaveBeenCalledTimes(4);
    const messages = loggedErrors();
    expect(messages).toHaveLength(4);
    expect(messages[0]).toContain(
      `Error calling queryFilter on contract ${CONTRACT_ADDRESS} (attempt 1/4): `,
    );
    expect(messages[3]).toContain('(attempt 4/4)');
    for (const message of messages) {
      expect(message).not.toContain('FAKEKEY');
      expect(message).not.toContain('/v2/');
      expect(message).not.toContain(FAKE_URL);
      expect(message).toContain(
        'exceeded maximum retry limit (code=UNKNOWN_ERROR, status=429 Too Many Requests)',
      );
    }
    // The thrown error is untouched: callers still see the original message.
    expect(error.message).toContain('FAKEKEY');
    expect(warnSpy()).not.toHaveBeenCalled();
  });

  it('returns the fallback value after the retries and logs a redacted warning', async () => {
    const queryFilter = jest.fn().mockRejectedValue(makeProviderError());

    await expect(
      safeContractCall(makeContract(queryFilter), 'queryFilter', [], {
        retries: 1,
        retryDelay: 0,
        fallbackValue: [],
      }),
    ).resolves.toEqual([]);

    expect(queryFilter).toHaveBeenCalledTimes(2);
    expect(loggedErrors()).toHaveLength(2);
    expect(warnSpy()).toHaveBeenCalledTimes(1);
    const warning = String(warnSpy().mock.calls[0][0]);
    expect(warning).toContain(
      `Using fallback value for queryFilter on contract ${CONTRACT_ADDRESS} after 2 failed attempts`,
    );
    expect(warning).not.toContain('FAKEKEY');
  });

  it('does not log when logErrors is false but still retries and rethrows', async () => {
    const error = makeProviderError();
    const queryFilter = jest.fn().mockRejectedValue(error);

    await expect(
      safeContractCall(makeContract(queryFilter), 'queryFilter', [], {
        retries: 2,
        retryDelay: 0,
        logErrors: false,
      }),
    ).rejects.toBe(error);

    expect(queryFilter).toHaveBeenCalledTimes(3);
    expect(errorSpy()).not.toHaveBeenCalled();
    expect(warnSpy()).not.toHaveBeenCalled();
  });

  it('wraps non-Error rejections in an Error and logs their text', async () => {
    const queryFilter = jest.fn().mockRejectedValue('plain failure');

    await expect(
      safeContractCall(makeContract(queryFilter), 'queryFilter', [], {
        retries: 0,
      }),
    ).rejects.toThrow('plain failure');

    expect(loggedErrors()).toEqual([
      `Error calling queryFilter on contract ${CONTRACT_ADDRESS} (attempt 1/1): plain failure`,
    ]);
  });

  it('logs plain errors with their full message', async () => {
    const queryFilter = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(
      safeContractCall(makeContract(queryFilter), 'queryFilter', [], {
        retries: 0,
      }),
    ).rejects.toThrow('boom');

    expect(loggedErrors()[0]).toMatch(/\(attempt 1\/1\): boom$/);
  });
});
