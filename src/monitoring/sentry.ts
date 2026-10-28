import * as Sentry from '@sentry/nestjs';
import type { ErrorEvent, Event, EventHint, StackFrame } from '@sentry/nestjs';

type TransactionEvent = Parameters<
  NonNullable<Sentry.NodeOptions['beforeSendTransaction']>
>[0];

// Keep telemetry independent of Nest imports: instrument.ts runs before Nest loads.
export const operations = [
  'http',
  'bootstrap',
  'state.poll',
  'events.resync',
  'events.queue',
  'events.startup',
  'events.process',
  'alerts.schedule',
  'alerts.event',
  'cma',
] as const;
export type Operation = (typeof operations)[number];
const captured = new WeakSet<object>();

export function captureFailure(error: unknown, operation: Operation): void {
  if (!Sentry.isEnabled()) return;
  if (error !== null && typeof error === 'object') {
    if (captured.has(error)) return;
    captured.add(error);
  }
  Sentry.captureException(error, { tags: { operation } });
}

export function captureHttpFailure(error: unknown, status: number): void {
  if (status >= 500 && status <= 599) captureFailure(error, 'http');
}

function isExpectedHttpError(error: unknown): boolean {
  if (
    !error ||
    typeof error !== 'object' ||
    !('getStatus' in error) ||
    typeof error.getStatus !== 'function'
  )
    return false;
  try {
    const status = (error as { getStatus: () => unknown }).getStatus();
    return typeof status === 'number' && status >= 400 && status < 500;
  } catch {
    return false;
  }
}

// Keep module identity for debug-ID symbolication, but never remote URLs or home paths.
export function safeCodePath(value: string | undefined): string | undefined {
  if (!value || /[?#]|:\/\/|0x[a-f\d]{40}/i.test(value)) return undefined;
  const normalized = value.replace(/\\/g, '/');
  const match = normalized.match(
    /(?:^|\/)(dist|src|node_modules)\/([\w./@-]+\.[cm]?js|[\w./@-]+\.ts)$/,
  );
  return match ? `app:///${match[1]}/${match[2]}` : undefined;
}

function safeFrame(frame: StackFrame): StackFrame {
  return {
    filename: safeCodePath(frame.filename),
    abs_path: safeCodePath(frame.abs_path ?? frame.filename),
    // Computed function names can contain wallet addresses or credentials.
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
  };
}

const safeTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'HttpException',
  'InternalServerErrorException',
  'ServiceUnavailableException',
  'QueryFailedError',
]);

function safeBase(event: Event): Event {
  const trace = event.contexts?.trace;
  return {
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    // Prevent Relay from deriving a location from the ingestion connection.
    user: { ip_address: '0.0.0.0' },
    contexts: trace
      ? {
          trace: {
            trace_id: trace.trace_id,
            span_id: trace.span_id,
            parent_span_id: trace.parent_span_id,
          },
        }
      : undefined,
  };
}

export function sanitizeErrorEvent(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  if (isExpectedHttpError(hint.originalException)) return null;
  // Attachments, messages, request data, breadcrumbs and arbitrary metadata can contain credentials.
  hint.attachments = [];
  const operation = event.tags?.operation;
  return {
    ...safeBase(event),
    type: undefined,
    tags:
      typeof operation === 'string' &&
      operations.includes(operation as Operation)
        ? { operation }
        : undefined,
    exception: {
      values: event.exception?.values?.map((exception) => ({
        type:
          exception.type && safeTypes.has(exception.type)
            ? exception.type
            : 'Error',
        value: 'Backend operation failed',
        stacktrace: exception.stacktrace
          ? { frames: exception.stacktrace.frames?.map(safeFrame) }
          : undefined,
        mechanism: exception.mechanism
          ? { type: 'generic', handled: exception.mechanism.handled }
          : undefined,
      })),
    },
    debug_meta: {
      images: event.debug_meta?.images?.flatMap((image) => {
        const codeFile = safeCodePath(image.code_file);
        return image.type === 'sourcemap' &&
          codeFile &&
          /^[a-f\d-]{36}$/i.test(image.debug_id)
          ? [
              {
                type: 'sourcemap' as const,
                code_file: codeFile,
                debug_id: image.debug_id,
              },
            ]
          : [];
      }),
    },
  };
}

export function sanitizeTransaction(
  event: TransactionEvent,
  hint: EventHint = {},
): TransactionEvent {
  hint.attachments = [];
  return {
    ...safeBase(event),
    type: 'transaction',
    transaction: 'backend.request',
    transaction_info: { source: 'custom' },
    start_timestamp: event.start_timestamp,
    // Outbound RPC/database spans can contain credential-bearing URLs or query values.
    spans: [],
  };
}

export function sentryOptions(
  env: NodeJS.ProcessEnv,
): Sentry.NodeOptions | undefined {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return undefined;
  const rate = Number(env.SENTRY_TRACES_SAMPLE_RATE ?? 0);
  return {
    dsn,
    environment:
      env.SENTRY_ENVIRONMENT ||
      env.RAILWAY_ENVIRONMENT_NAME ||
      env.NODE_ENV ||
      'development',
    release: env.SENTRY_RELEASE || env.RAILWAY_GIT_COMMIT_SHA || undefined,
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    tracesSampleRate:
      Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0,
    tracePropagationTargets: [],
    enableLogs: false,
    enableMetrics: false,
    sendClientReports: false,
    maxBreadcrumbs: 0,
    defaultIntegrations: false,
    integrations: [
      Sentry.httpIntegration({
        breadcrumbs: false,
        trackIncomingRequestsAsSessions: false,
        ignoreIncomingRequestBody: () => true,
        ignoreOutgoingRequests: () => true,
      }),
      Sentry.expressIntegration(),
      Sentry.nestIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    beforeSend: sanitizeErrorEvent,
    beforeSendTransaction: sanitizeTransaction,
    beforeBreadcrumb: () => null,
  };
}
