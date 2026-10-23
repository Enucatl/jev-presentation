// Synthetic data exercises rendering in a disposable copy; it is never a replay deliverable.
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serveDist } from './serve-dist.mjs';
import { validateFixture, endpoint } from './validate-fixtures.mjs';

const directory = await mkdtemp(join(tmpdir(), 'jev-render-'));
let browser, server;
try {
  for (const name of ['index.html', 'main.js', 'slides.js', 'style.css', 'vite.config.js', 'package.json', 'fixtures', 'assets', 'scripts/validate-fixtures.mjs']) {
    await cp(name, join(directory, name), { recursive: true });
  }
  await symlink(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
  const fixture = JSON.parse(await readFile('fixtures/finance.json', 'utf8'));
  const request = fixture.request;
  const answers = Object.fromEntries(Object.entries(request.questions).map(([id, q]) => {
    if (q.type === 'noul') return [id, { type: q.type, noul: .1 }];
    const labels = q.type === 'score' ? q.criteria.map((_, i) => String(i)) : Object.keys(q.criteria);
    const probabilities = Object.fromEntries(labels.map((label, i) => [label, i ? 0 : 1]));
    return [id, { type: q.type, probabilities, confidence: 1, ...(q.type === 'choice' ? { choice: labels[0] } : { score: 0, legend: Object.fromEntries(q.criteria.map((label, i) => [String(i), label])) }) }];
  }));
  const response = { model: request.model, answers };
  const synthetic = { status: 'captured', endpoint, capturedAt: '2026-10-23T00:00:00.000Z', request, response, rawRequest: JSON.stringify(request), rawResponse: JSON.stringify(response) };
  validateFixture(synthetic);
  await writeFile(join(directory, 'fixtures/finance.json'), JSON.stringify(synthetic));
  execFileSync('npm', ['run', 'build'], { cwd: directory, stdio: 'pipe' });
  server = await serveDist(join(directory, 'dist'));
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(server.url + '/jev-presentation/#/replay');
  await page.waitForFunction(() => window.deck?.isReady());
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#replay-output article').count(), 4);
  assert.match(await page.locator('#replay-output').innerText(), /Recorded response · jev-1.13.0 · 2026-10-23/);
  assert.match(await page.locator('#replay-output').innerText(), /p\(yes\) = 0.1/);
  assert.match(await page.locator('#replay-output').innerText(), /Selected: Employment income/);
  assert.equal(await page.locator('#replay-output .bars').count(), 3);
  assert.equal(await page.locator('#replay-output .bar-row').count(), 13);
  assert.equal(await page.locator('#replay-output .pending').count(), 0);
  const overflow = await page.locator('#replay-output').evaluate(el => el.getBoundingClientRect().bottom > document.querySelector('#replay footer').getBoundingClientRect().top);
  assert.equal(overflow, false, 'Captured replay overlaps footer');
  console.log('PASS synthetic capture rendering in disposable copy: all four answers, labels, probabilities, provenance, layout');
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
  await rm(directory, { recursive: true, force: true });
}
