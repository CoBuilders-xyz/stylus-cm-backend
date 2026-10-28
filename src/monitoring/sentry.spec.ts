import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  sanitizeErrorEvent,
  sanitizeTransaction,
  sentryOptions,
  safeCodePath,
} from './sentry';
import type { ErrorEvent } from '@sentry/nestjs';

const fakeDsn = 'https://public@example.invalid/1';

describe('Sentry privacy and configuration', () => {
  it('does not initialize without a DSN', () => {
    expect(sentryOptions({})).toBeUndefined();
    expect(sentryOptions({ SENTRY_DSN: '  ' })).toBeUndefined();
  });

  it('uses explicit settings, then Railway settings, with tracing disabled by default', () => {
    const env = {
      SENTRY_DSN: fakeDsn,
      NODE_ENV: 'production',
      RAILWAY_ENVIRONMENT_NAME: 'staging',
      RAILWAY_GIT_COMMIT_SHA: 'commit-sha',
    };
    expect(sentryOptions(env)).toMatchObject({
      environment: 'staging',
      release: 'commit-sha',
      tracesSampleRate: 0,
      sendDefaultPii: false,
      enableLogs: false,
      maxBreadcrumbs: 0,
    });
    expect(
      sentryOptions({
        ...env,
        SENTRY_ENVIRONMENT: 'preview',
        SENTRY_RELEASE: 'override',
        SENTRY_TRACES_SAMPLE_RATE: '0.05',
      }),
    ).toMatchObject({
      environment: 'preview',
      release: 'override',
      tracesSampleRate: 0.05,
    });
    for (const value of ['NaN', 'Infinity', '-1', '1.01']) {
      expect(
        sentryOptions({ ...env, SENTRY_TRACES_SAMPLE_RATE: value })
          ?.tracesSampleRate,
      ).toBe(0);
    }
  });

  it('drops expected HTTP errors, but keeps explicit 5xx errors', () => {
    const event: ErrorEvent = { type: undefined };
    expect(
      sanitizeErrorEvent(event, {
        originalException: new BadRequestException(),
      }),
    ).toBeNull();
    expect(
      sanitizeErrorEvent(event, {
        originalException: new InternalServerErrorException(),
      }),
    ).not.toBeNull();
  });

  it('removes sensitive event fields and attachment content, preserving module/debug-ID associations', () => {
    const secret = 'PRIVATE_AUTH_COOKIE_WALLET_RPC_VALUE';
    const filename = '/app/dist/service.js';
    const debugId = 'e2b94f60-7c7d-4ed7-a7e2-7317a8decb92';
    const event: ErrorEvent = {
      type: undefined,
      message: secret,
      logentry: { message: secret },
      request: {
        headers: { authorization: secret },
        cookies: { session: secret },
        url: `https://rpc.invalid/${secret}`,
        data: secret,
      },
      user: { id: secret, ip_address: secret },
      extra: { payload: secret },
      breadcrumbs: [{ message: secret }],
      tags: { operation: 'state.poll', wallet: secret },
      contexts: {
        custom: { secret },
        trace: {
          trace_id: 'a'.repeat(32),
          span_id: 'b'.repeat(16),
          data: { secret },
        },
      },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: secret,
            stacktrace: {
              frames: [
                {
                  filename,
                  abs_path: filename,
                  lineno: 23,
                  colno: 4,
                  context_line: secret,
                  vars: { secret },
                  pre_context: [secret],
                  post_context: [secret],
                },
              ],
            },
          },
        ],
      },
      debug_meta: {
        images: [{ type: 'sourcemap', code_file: filename, debug_id: debugId }],
      },
    };
    const hint = { attachments: [{ filename: 'secret.txt', data: secret }] };
    const sanitized = sanitizeErrorEvent(event, hint)!;
    expect(JSON.stringify(sanitized)).not.toContain(secret);
    expect(hint.attachments).toEqual([]);
    expect(sanitized.exception?.values?.[0]).toMatchObject({
      type: 'TypeError',
      stacktrace: {
        frames: [
          {
            filename: 'app:///dist/service.js',
            abs_path: 'app:///dist/service.js',
            lineno: 23,
            colno: 4,
          },
        ],
      },
    });
    expect(sanitized.debug_meta?.images?.[0]).toEqual({
      type: 'sourcemap',
      code_file:
        sanitized.exception?.values?.[0].stacktrace?.frames?.[0].abs_path,
      debug_id: debugId,
    });
    expect(
      sanitized.exception?.values?.[0].stacktrace?.frames?.[0].function,
    ).toBeUndefined();
    expect(event.exception?.values?.[0].value).toBe(secret);
  });

  it('rejects remote and secret-bearing stack paths', () => {
    for (const path of [
      'https://rpc.invalid/token',
      '/app/dist/file.js?token=private',
      '/Users/private/file.js',
    ])
      expect(safeCodePath(path)).toBeUndefined();
    expect(safeCodePath('/app/node_modules/@nestjs/core/index.js')).toBe(
      'app:///node_modules/@nestjs/core/index.js',
    );
  });

  it('drops transaction metadata and outbound spans', () => {
    const result = sanitizeTransaction({
      type: 'transaction',
      transaction: '/wallet/private',
      request: { data: 'private' },
      spans: [
        {
          span_id: 'a',
          trace_id: 'b',
          start_timestamp: 1,
          timestamp: 2,
          description: 'https://rpc.invalid/private',
          data: {},
        },
      ],
      start_timestamp: 1,
      timestamp: 2,
      contexts: {
        trace: {
          trace_id: 'a'.repeat(32),
          span_id: 'b'.repeat(16),
          data: { url: 'private' },
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(result).toMatchObject({
      transaction: 'backend.request',
      spans: [],
      start_timestamp: 1,
      timestamp: 2,
    });
  });
});
