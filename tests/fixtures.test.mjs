import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { endpoint, fixturePath, validateFixture } from '../scripts/validate-fixtures.mjs';

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const syntheticCapture = () => {
  // Synthetic unit-test data only; never used as a replay capture.
  const request = structuredClone(fixture.request);
  const answers = Object.fromEntries(Object.entries(request.questions).map(([id, q]) => {
    if (q.type === 'noul') return [id, { type: 'noul', noul: 0.1 }];
    const labels = q.type === 'score' ? q.criteria.map((_, i) => String(i)) : Object.keys(q.criteria);
    const probabilities = Object.fromEntries(labels.map((label, i) => [label, i === 0 ? 1 : 0]));
    return [id, q.type === 'choice'
      ? { type: 'choice', choice: labels[0], probabilities, confidence: 1 }
      : { type: 'score', score: 0, probabilities, confidence: 1, legend: Object.fromEntries(q.criteria.map((label, i) => [String(i), label])) }];
  }));
  const response = { model: request.model, answers };
  return { status: 'captured', endpoint, capturedAt: '2026-10-23T10:00:00.000Z', request, rawRequest: JSON.stringify(request), response, rawResponse: JSON.stringify(response) };
};
const mutate = fn => { const value = syntheticCapture(); fn(value); value.rawResponse = JSON.stringify(value.response); return value; };

test('committed fixture validates; pending output cannot masquerade as capture', () => {
  validateFixture(fixture);
  assert.throws(() => validateFixture({ ...fixture, status: 'awaiting_capture', reason: 'pending', response: {} }));
});
test('capture validates schema, sums, mappings, scores and provenance', () => {
  validateFixture(syntheticCapture());
  assert.throws(() => validateFixture(mutate(f => { f.response.answers.source.probabilities.Gift = 0.9; })));
  assert.throws(() => validateFixture(mutate(f => { f.response.answers.source.probabilities.Other = 0; })));
  assert.throws(() => validateFixture(mutate(f => { f.response.answers.support.score = 2; })));
  assert.throws(() => validateFixture(mutate(f => { f.response.answers.support.legend['0'] = 'Supported'; })));
  assert.throws(() => validateFixture(mutate(f => { f.response.answers.seller.noul = -1; })));
  assert.throws(() => validateFixture(mutate(f => { f.response.model = 'jev-latest'; })));
  assert.throws(() => validateFixture(mutate(f => { f.capturedAt = 'not a date'; })));
  const mismatched = syntheticCapture(); mismatched.rawResponse = '{}';
  assert.throws(() => validateFixture(mismatched));
});
