/**
 * 🚀 SIMPLE TEST LOGGING UTILITY
 *
 * Minimal and clean test logging for all test suites.
 *
 * Usage:
 * ```typescript
 * import { logTestResult, logTestError } from '../common/utils/test-logger.util';
 *
 * logTestResult('TEST NAME', { result: 'success' });
 * logTestError('TEST NAME', error, {}, true); // true = expected error
 * ```
 */

let ENABLE_LOGS = true;

export const enableTestLogs = (): void => {
  ENABLE_LOGS = true;
};

export const disableTestLogs = (): void => {
  ENABLE_LOGS = false;
};

export const logTestResult = (
  testTitle: string,
  _values: Record<string, unknown>,
  result?: any,
): void => {
  if (!ENABLE_LOGS) return;

  const status = result?.testPassed === true ? '✅' : '❌';
  const summary = result?.errorType ? `(${result.errorType})` : '';
  process.stdout.write(`${status} ${testTitle} ${summary}\n`);
};

export const logTestError = (
  testTitle: string,
  error: Error,
  _context?: Record<string, unknown>,
  isExpected = false,
): void => {
  if (!ENABLE_LOGS) return;

  const prefix = isExpected ? '✅ Expected Error' : '❌ Unexpected Error';
  process.stdout.write(`${prefix}: ${testTitle} - ${error.message}\n`);
};
