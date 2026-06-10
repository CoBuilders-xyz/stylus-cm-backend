/**
 * Fetch the OpenAPI spec from a running backend instance and write it
 * to the MkDocs api directory. The backend must be running (e.g. via Docker).
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/generate-openapi.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const OUTPUT_PATH = path.resolve(
  __dirname,
  '../../../mkdocs/docs/en/api/openapi.json',
);

async function main() {
  console.log(`Fetching OpenAPI spec from ${BACKEND_URL}/api-json ...`);
  const res = await fetch(`${BACKEND_URL}/api-json`);
  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}: ${res.statusText}`);
  }
  const spec = await res.json();
  const pathCount = Object.keys(spec.paths || {}).length;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(spec, null, 2));
  console.log(`Wrote ${pathCount} paths to ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
