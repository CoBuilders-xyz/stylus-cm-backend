const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareSourceMaps } = require('../scripts/sentry-sourcemaps.cjs');

function fixture() {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'backend-sentry-maps-'),
  );
  fs.writeFileSync(
    path.join(directory, 'example.js'),
    'throw new Error("example");\n//# sourceMappingURL=example.js.map\n',
  );
  fs.writeFileSync(
    path.join(directory, 'example.js.map'),
    JSON.stringify({
      version: 3,
      file: 'example.js',
      sources: ['example.ts'],
      sourcesContent: ['throw new Error("example");'],
      names: [],
      mappings: 'AAAA,MAAM,IAAI,KAAK,CAAC,SAAS,CAAC,CAAC',
    }),
  );
  return directory;
}

test('build without upload auth succeeds, removes maps, and produces deterministic debug IDs across paths', () => {
  const first = fixture();
  const second = fixture();
  try {
    const env = {
      ...process.env,
      SENTRY_AUTH_TOKEN: '',
      SENTRY_ORG: '',
      SENTRY_PROJECT: '',
    };
    prepareSourceMaps(first, env);
    prepareSourceMaps(second, env);
    assert.deepEqual(fs.readdirSync(first), ['example.js']);
    assert.deepEqual(fs.readdirSync(second), ['example.js']);
    const output = fs.readFileSync(path.join(first, 'example.js'), 'utf8');
    assert.match(output, /debugId=[a-f\d-]{36}/);
    assert.equal(
      output,
      fs.readFileSync(path.join(second, 'example.js'), 'utf8'),
    );
  } finally {
    fs.rmSync(first, { recursive: true, force: true });
    fs.rmSync(second, { recursive: true, force: true });
  }
});

test('misconfigured authenticated upload fails, but still removes source maps', () => {
  const directory = fixture();
  try {
    assert.throws(
      () =>
        prepareSourceMaps(directory, {
          ...process.env,
          SENTRY_AUTH_TOKEN: 'fake-test-only',
          SENTRY_ORG: '',
          SENTRY_PROJECT: '',
        }),
      /requires SENTRY_ORG and SENTRY_PROJECT/,
    );
    assert.deepEqual(fs.readdirSync(directory), ['example.js']);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
