# Backend monitoring

Sentry reports unexpected HTTP 5xx failures, process errors, and background failures.
The integration is disabled when `SENTRY_DSN` is empty. Existing application logs retain their existing sanitizers.

## Runtime configuration

| Variable                    | Default                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `SENTRY_DSN`                | Empty; monitoring disabled                                      |
| `SENTRY_ENVIRONMENT`        | `RAILWAY_ENVIRONMENT_NAME`, then `NODE_ENV`, then `development` |
| `SENTRY_RELEASE`            | `RAILWAY_GIT_COMMIT_SHA`                                        |
| `SENTRY_TRACES_SAMPLE_RATE` | `0`; invalid values also disable tracing                        |

Use separate staging and production environments. Start with tracing disabled; `0.05` is a conservative opt-in rate.
Errors remain enabled with a DSN regardless of tracing rate. No replay, profiling, logs, or custom metrics are enabled.
No production test endpoint is installed.

`src/instrument.ts` loads dotenv and initializes Sentry before framework imports.
The integration uses the latest Sentry v10 line, which supports NestJS 11 and `sendDefaultPii: false`.
SDK v11 replaces that option with `dataCollection`; review privacy tests before upgrading.

## Capture and privacy

The existing global catch-all filter captures HTTP 5xx errors explicitly. Expected 4xx errors are excluded.
The SDK captures uncaught exceptions, rejected promises, and escaping Cron, event-listener, and Nest BullMQ errors.
Explicit captures cover swallowed state-polling, resync, alert, CMA automation, startup, and event-processing failures.
Raw BullMQ event workers report terminal job failures after retries and worker/queue errors.
The same Error object is reported once across explicit and SDK capture paths.

Telemetry uses an allowlist. It preserves exception classes, stack module paths, line/column locations, and static operation tags.
It removes function names because computed names can include private values.
It replaces exception messages with a fixed description. It removes request data, users, breadcrumbs, attachments, locals, and arbitrary metadata.
This prevents authentication, cookies, tokens, wallet addresses, provider URLs, and job payloads from reaching Sentry.
A fixed `0.0.0.0` IP placeholder prevents Sentry from inferring location from the ingestion connection.
No outbound trace headers are propagated. Optional tracing retains aggregate root timing, without outbound spans or dynamic request names.

Stack paths and debug image paths use the same `app:///dist/...` normalization.
Debug IDs remain intact for source-map association. Local usernames and remote URLs are excluded.

## Railway builds and private source maps

Railway builds with the existing Dockerfile using Node 22.14.0 and `npm ci`.
`npm start` and `npm run start:prod` execute `dist/src/main.js` directly.
They do not recompile or recreate deleted source maps. Use `npm run start:dev` for local watch mode.

`npm run build` compiles, injects deterministic debug IDs, optionally uploads source maps, and always deletes `.map` files.
Missing upload credentials do not fail local or Railway builds. Misconfigured or failed authenticated uploads fail the build.
CLI output is suppressed so errors cannot disclose credentials or remote URLs.

The `Upload Sentry source maps` workflow runs on pushes to `main` and `staging`, and supports manual dispatch.
It uses the same Node version and lockfile as Docker. Configure:

- Repository secret `SENTRY_AUTH_TOKEN`, scoped to release/source-map uploads.
- Organization `cobuilders` and project `stylus-cm-backend` are non-secret workflow settings.
- CI release is the commit SHA, matching Railway's default runtime release.

The upload token is available only to the CI build step. Do not pass it through Docker ARGs or runtime configuration.
The workflow publishes no source-map artifacts. Upload can complete after Railway starts; check CI status before production promotion.
If overriding `SENTRY_RELEASE`, use the same value for the CI upload. Debug-ID association also works independently of release names.

## Verification

Run `npm test -- --runInBand`, `npm run build`, then `npm run test:monitoring`.
The runtime suite uses a local in-memory Sentry transport. It exercises the real Nest HTTP/filter pipeline and SDK job instrumentation.
It checks duplicate prevention, 4xx exclusion, privacy, no-DSN startup, debug-ID determinism, and source-map cleanup.
It does not send test events to Sentry or require a database, Redis, or real credentials.

After deployment, verify the release and environment in Sentry using an approved staging failure.
Confirm stack traces resolve to TypeScript. Keep debug endpoints out of production.

SDK setup reference: https://docs.sentry.io/platforms/javascript/guides/nestjs/
