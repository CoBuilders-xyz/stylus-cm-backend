/**
 * Log sanitizer.
 *
 * Provider RPC URLs carry the API key as the last path segment, and ethers v6
 * serializes the request URL into `error.message`
 * (`info={ "requestUrl": "https://host/v2/<key>" }`). Any log line that
 * interpolates such a message would write the key to the log sink.
 *
 * These helpers only change how text is formatted before it is logged. They
 * never touch the error objects themselves, so callers keep rethrowing,
 * retrying and returning exactly what they did before.
 */

export const REDACTED = '<redacted>';

// A value ends at whitespace, quotes, angle brackets, a backslash (escaped
// JSON such as {\"apiKey\":\"...\"}) or ESC (ANSI color codes emitted by
// util.inspect when colors are on). Keeping ESC out of the value means the
// color reset that follows a value survives the redaction.

// scheme://[userinfo@]host[:port][/path][?query][#fragment]
// The authority also stops at "/", "?" and "#". Trailing punctuation is kept
// outside the redaction so the surrounding prose survives.
// A word boundary or the end of an ANSI color code may precede a match.
/* eslint-disable no-control-regex -- \x1b (ESC) starts ANSI color codes */
const URL_PATTERN =
  /(?:\b|(?<=\x1b\[[0-9;]*m))(https?|wss?):\/\/([^\s/?#"'`<>\\\x1b]+)([/?#][^\s"'`<>\\\x1b]*)?/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

// "Bearer <token>" in headers or serialized requests.
const BEARER_PATTERN =
  /(?:\b|(?<=\x1b\[[0-9;]*m))(bearer)\s+([^\s"'`<>,;)\]}\\\x1b]+)/gi;

// key=value / key: value / "key": "value" / \"key\":\"value\" pairs whose key
// name ends with a secret-looking word (apiKey, api_key, access_token,
// x-api-key, token, key, secret, password, authorization, ...). Optional ANSI
// color codes may sit between the separator and the value. A value that
// opens an object or an array ({ or [) is not a secret and is not matched.
const SECRET_PAIR_PATTERN =
  /\b([\w-]*(?:key|token|secret|password|authorization))\b(\\?["']?\s*[=:]\s*(?:\x1b\[[0-9;]*m)*\\?["']?)([^\s"'`<>&,;)\]}{[\\\x1b]+)/gi;
// Unquoted JSON/JS scalars that are never secrets: numbers, null, booleans.
const PLAIN_SCALAR = /^(?:-?\d+(?:\.\d+)?|null|true|false|undefined)$/i;
/* eslint-enable no-control-regex */

/**
 * Replaces the path, query and fragment of every http(s)/ws(s) URL with
 * `/<redacted>` and drops any userinfo. Scheme and host are kept so the log
 * still says which provider failed. URLs without a path are left unchanged.
 */
export function redactUrls(text: string): string {
  return text.replace(
    URL_PATTERN,
    (match: string, scheme: string, authority: string, rest?: string) => {
      const atIndex = authority.lastIndexOf('@');
      const host = atIndex === -1 ? authority : authority.slice(atIndex + 1);
      const hadUserInfo = atIndex !== -1;

      const trailing = rest ? (TRAILING_PUNCTUATION.exec(rest)?.[0] ?? '') : '';
      const path = rest ? rest.slice(0, rest.length - trailing.length) : '';
      const redactPath = path !== '' && path !== '/';

      if (!hadUserInfo && !redactPath) {
        return match;
      }
      const suffix = redactPath ? `/${REDACTED}` : path;
      return `${scheme}://${host}${suffix}${trailing}`;
    },
  );
}

/**
 * Masks bearer tokens: `Bearer abc.def` becomes `Bearer <redacted>`.
 */
export function maskBearerTokens(text: string): string {
  return text.replace(BEARER_PATTERN, `$1 ${REDACTED}`);
}

/**
 * Masks the value of secret-looking key/value pairs outside URLs, in query
 * (`apiKey=...`), prose (`token: ...`), JSON (`"access_token": "..."`) and
 * escaped JSON (`\"apiKey\":\"...\"`) form.
 */
export function maskSecretPairs(text: string): string {
  return text.replace(
    SECRET_PAIR_PATTERN,
    (match: string, key: string, separator: string, value: string) => {
      // "authorization: Bearer <redacted>" is already masked by maskBearerTokens.
      if (/^bearer$/i.test(value)) {
        return match;
      }
      // {"key":123} / token: null / enabled=true keep their value (and stay
      // valid JSON); only quoted scalars and bare non-scalar values are masked.
      const quoted = /["']$/.test(separator);
      if (!quoted && PLAIN_SCALAR.test(value)) {
        return match;
      }
      return `${key}${separator}${REDACTED}`;
    },
  );
}

/**
 * Applies every redaction to a piece of text. Text without URLs, bearer
 * tokens or secret-looking pairs is returned unchanged.
 */
export function sanitizeText(text: string): string {
  return maskSecretPairs(maskBearerTokens(redactUrls(text)));
}

interface EthersErrorShape {
  shortMessage?: unknown;
  code?: unknown;
  info?: unknown;
}

/**
 * ethers v6 errors expose `shortMessage` (the message without the serialized
 * request details) and `code`. Prefer those; they never contain the URL.
 * Other errors keep their full message.
 */
function describeError(error: Error): string {
  const { shortMessage, code, info } = error as Error & EthersErrorShape;
  if (typeof shortMessage !== 'string' || shortMessage.length === 0) {
    return error.message;
  }

  const details: string[] = [];
  if (typeof code === 'string' || typeof code === 'number') {
    details.push(`code=${code}`);
  }
  const status = (info as { responseStatus?: unknown } | null | undefined)
    ?.responseStatus;
  if (typeof status === 'string' || typeof status === 'number') {
    details.push(`status=${status}`);
  }

  return details.length > 0
    ? `${shortMessage} (${details.join(', ')})`
    : shortMessage;
}

function stringifyUnknown(input: unknown): string {
  try {
    return String(input);
  } catch {
    return '[unserializable value]';
  }
}

/**
 * Returns a log-safe description of any caught value.
 * - ethers errors: `shortMessage (code=..., status=...)`
 * - other errors: their message
 * - anything else: `String(value)`
 * The result is always passed through `sanitizeText`.
 */
export function sanitizeForLog(input: unknown): string {
  if (input instanceof Error) {
    return sanitizeText(describeError(input));
  }
  if (typeof input === 'string') {
    return sanitizeText(input);
  }
  return sanitizeText(stringifyUnknown(input));
}

/**
 * Returns the sanitized stack trace of an Error, or `undefined` when the
 * value is not an Error or has no stack. Meant for the second argument of
 * `logger.error(message, stack)`.
 */
export function sanitizeStackForLog(input: unknown): string | undefined {
  if (input instanceof Error && typeof input.stack === 'string') {
    return sanitizeText(input.stack);
  }
  return undefined;
}
