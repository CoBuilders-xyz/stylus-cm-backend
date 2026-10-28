const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function removeMaps(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) removeMaps(file);
    else if (entry.name.endsWith('.map')) fs.unlinkSync(file);
  }
}

function runCli(args, env) {
  // CLI failures may contain remote URLs or credentials. Report only a static failure.
  const cli = require.resolve('@sentry/cli/bin/sentry-cli');
  const result = spawnSync(process.execPath, [cli, ...args], {
    env,
    stdio: 'pipe',
  });
  if (result.error || result.status !== 0)
    throw new Error('Sentry source-map command failed');
}

function prepareSourceMaps(directory = 'dist', env = process.env) {
  try {
    // Debug IDs derive from file contents, so CI and Railway must use the same lockfile and Node version.
    runCli(['sourcemaps', 'inject', directory], {
      ...env,
      SENTRY_LOG_LEVEL: 'error',
    });
    if (!env.SENTRY_AUTH_TOKEN) {
      console.log('Sentry upload skipped: no upload token configured.');
      return;
    }
    if (!env.SENTRY_ORG || !env.SENTRY_PROJECT) {
      throw new Error('Sentry upload requires SENTRY_ORG and SENTRY_PROJECT');
    }
    const release = env.SENTRY_RELEASE || env.RAILWAY_GIT_COMMIT_SHA;
    const args = ['sourcemaps', 'upload', directory];
    if (release) args.push('--release', release);
    runCli(args, { ...env, SENTRY_LOG_LEVEL: 'error' });
    console.log('Sentry source maps uploaded.');
  } finally {
    // Neither missing credentials nor upload failures leave source maps in runtime artifacts.
    removeMaps(directory);
  }
}

module.exports = { prepareSourceMaps };
if (require.main === module) {
  try {
    prepareSourceMaps();
  } catch {
    console.error(
      'Sentry source-map preparation failed. Check CI upload configuration.',
    );
    process.exitCode = 1;
  }
}
