import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { endpoint, fixturePath, validateFixture } from './validate-fixtures.mjs';

const key = process.env.TYPESAFE_API_KEY;
if (!key) throw new Error('Set TYPESAFE_API_KEY to capture real responses. The pending fixture is unchanged.');
const previous = JSON.parse(await readFile(fixturePath, 'utf8'));
validateFixture(previous);
const rawRequest = JSON.stringify(previous.request);
const result = await fetch(endpoint, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: rawRequest,
  signal: AbortSignal.timeout(60000),
});
if (!result.ok) throw new Error(`TypeSafe capture failed: HTTP ${result.status}. Existing fixture is unchanged.`);
const rawResponse = await result.text();
const capturedAt = new Date().toISOString();
const fixture = { status: 'captured', endpoint, capturedAt, request: previous.request, rawRequest, response: JSON.parse(rawResponse), rawResponse };
validateFixture(fixture);
const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
const archiveDir = new URL('../fixtures/captures/', import.meta.url);
await mkdir(archiveDir, { recursive: true });
await writeFile(new URL(`${capturedAt.replaceAll(':', '-')}.json`, archiveDir), serialized, { flag: 'wx' });
const temporary = new URL('../fixtures/finance.json.tmp', import.meta.url);
await writeFile(temporary, serialized, { flag: 'wx' });
await rename(temporary, fixturePath);
console.log(`Captured ${fixture.response.model} at ${capturedAt}; replay fixture and timestamped archive saved. Rebuild the deck to replay it.`);
