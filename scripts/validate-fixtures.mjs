import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const endpoint = 'https://api.typesafe.ai/v1/systemone';
export const fixturePath = new URL('../fixtures/finance.json', import.meta.url);
const sameKeys = (actual, expected) => assert.deepEqual(Object.keys(actual).sort(), expected.sort());
const probability = value => assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, 'Probability must be in [0, 1]');

export function validateFixture(fixture) {
  const { request, response } = fixture;
  assert.equal(request.model, 'jev-1.13.0');
  assert.ok(request.state && typeof request.state === 'object');
  sameKeys(request.questions, ['source', 'support', 'seller', 'specificity']);
  assert.equal(request.questions.source.type, 'choice');
  sameKeys(request.questions.source.criteria, ['Employment income', 'Business proceeds', 'Inheritance', 'Gift', 'Unclear']);
  assert.equal(request.questions.seller.type, 'noul');
  for (const key of ['support', 'specificity']) assert.equal(request.questions[key].type, 'score');
  assert.deepEqual(request.questions.support.criteria, ['Contradicted', 'Unsupported', 'Partially supported', 'Supported']);
  assert.deepEqual(request.questions.specificity.criteria, ['Absent', 'Vague', 'Specific but incomplete', 'Detailed']);
  if (fixture.status === 'awaiting_capture') {
    assert.ok(fixture.reason);
    assert.equal(response, undefined, 'Pending fixtures must not contain invented responses');
    return;
  }
  assert.equal(fixture.status, 'captured');
  assert.equal(fixture.endpoint, endpoint);
  assert.ok(Number.isFinite(Date.parse(fixture.capturedAt)), 'Capture timestamp required');
  assert.deepEqual(JSON.parse(fixture.rawRequest), request);
  assert.deepEqual(JSON.parse(fixture.rawResponse), response);
  assert.equal(response.model, request.model, 'Capture must be answered by the pinned model');
  sameKeys(response.answers, Object.keys(request.questions));
  for (const [id, question] of Object.entries(request.questions)) {
    const answer = response.answers[id];
    assert.equal(answer.type, question.type);
    if (question.type === 'noul') {
      probability(answer.noul);
      continue;
    }
    const keys = question.type === 'choice' ? Object.keys(question.criteria) : question.criteria.map((_, i) => String(i));
    sameKeys(answer.probabilities, keys);
    const values = keys.map(key => answer.probabilities[key]);
    values.forEach(probability);
    // The public API rounds probabilities; allow half a percentage point per bin.
    const rounding = values.length * 0.005 + 1e-9;
    assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) - 1) <= rounding, `${id}: distribution must sum to one`);
    probability(answer.confidence);
    if (question.type === 'choice') {
      assert.ok(keys.includes(answer.choice));
      assert.ok(Math.max(...values) - answer.probabilities[answer.choice] <= 0.01, 'Choice must select a most likely option');
    } else {
      assert.deepEqual(answer.legend, Object.fromEntries(question.criteria.map((label, i) => [String(i), label])));
      const expected = values.reduce((sum, p, i) => sum + p * i, 0);
      const scoreRounding = 0.005 * values.reduce((sum, _, i) => sum + i, 1) + 1e-9;
      assert.ok(Number.isFinite(answer.score) && answer.score >= 0 && answer.score <= values.length - 1);
      assert.ok(Math.abs(answer.score - expected) <= scoreRounding, `${id}: score must equal expected level within rounding`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  validateFixture(fixture);
  console.log(`Finance fixture valid: ${fixture.status}`);
}
