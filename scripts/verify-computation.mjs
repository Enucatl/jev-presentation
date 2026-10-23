import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { illustrativeTokens } from '../slides.js';
import { serveDist } from './serve-dist.mjs';

const answer = { source_of_wealth: 'business', confidence: 'high' };
const server = await serveDist();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.clock.install();
  await page.goto(server.url + '/#/contract');
  await page.waitForFunction(() => window.deck?.isReady());
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.deck.configure({ transition: 'none' }));
  const slide = page.locator('#contract');
  const output = slide.locator('.computation-output');
  const replay = slide.locator('[data-replay-computation]');
  const cache = slide.locator('.kv-cache .kv-entry[data-active="true"]');
  const go = id => page.evaluate(id => window.deck.slide(window.deck.getIndices(document.getElementById(id)).h), id);
  const snapshot = () => slide.evaluate(el => ({
    phase: el.dataset.phase,
    output: el.querySelector('.computation-output').textContent,
    cache: el.querySelectorAll('.kv-entry[data-active="true"]').length,
    stages: [...el.querySelectorAll('.prefill-stage')].map(stage => stage.dataset.active),
  }));

  await replay.click();
  assert.equal(await slide.getAttribute('data-phase'), 'prefill');
  assert.equal(await output.textContent(), '', 'Prefill must precede output generation');
  assert.equal(await cache.count(), 0);
  await page.clock.runFor(650);
  assert(await slide.locator('.prefill-stage[data-active="true"]').count() > 0, 'Prefill stages should become active');
  assert.equal(await output.textContent(), '', 'No answer should stream during early prefill');
  await go('start');
  const stoppedPrefill = await snapshot();
  await page.clock.runFor(10000);
  assert.deepEqual(await snapshot(), stoppedPrefill, 'Prefill must stop off-slide');

  await go('contract');
  assert.equal(await slide.getAttribute('data-phase'), 'prefill');
  assert.equal(await output.textContent(), '');
  await page.clock.runFor(1850);
  assert.equal(await slide.getAttribute('data-phase'), 'decode');
  assert.equal((await output.textContent()).trim(), '{', 'Prefill must produce the first output chunk');
  assert.equal(await cache.count(), 0, 'The newest output token has not been fed back yet');
  await page.clock.runFor(400);
  assert.equal(await cache.count(), 1, 'Feeding back the first output should grow the KV cache');
  const decoding = await output.textContent();
  assert(decoding.length > 1 && !decoding.includes('high'));
  await page.clock.runFor(400);
  assert.equal(await cache.count(), 2, 'Each subsequent decode step should append one cached position');

  if (process.env.SCREENSHOTS) {
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/computation-decode.png', animations: 'disabled' });
  }
  await go('start');
  const stoppedDecode = await snapshot();
  await page.clock.runFor(10000);
  assert.deepEqual(await snapshot(), stoppedDecode, 'Decoding must stop off-slide');
  await go('contract');
  assert.equal(await slide.getAttribute('data-phase'), 'prefill');
  assert.equal(await cache.count(), 0, 'Reentry must reset the output-token cache');
  await page.clock.runFor(15000);
  assert.equal(await slide.getAttribute('data-phase'), 'complete');
  assert.deepEqual(JSON.parse(await output.textContent()), answer);
  assert.equal(await cache.count(), illustrativeTokens.length - 1, 'The last generated token must remain outside the KV cache');
  if (process.env.SCREENSHOTS) await page.screenshot({ path: 'artifacts/computation-complete.png', animations: 'disabled' });
  await replay.click();
  assert.equal(await slide.getAttribute('data-phase'), 'prefill');
  assert.equal(await output.textContent(), '');
  assert.equal(await cache.count(), 0);
  await page.close();

  for (const [name, options, path] of [
    ['reduced motion', { reducedMotion: 'reduce' }, '/#/contract'],
    ['print', {}, '/?print-pdf'],
  ]) {
    const staticPage = await browser.newPage(options);
    await staticPage.goto(server.url + path);
    await staticPage.waitForFunction(() => window.deck?.isReady());
    if (name === 'print') await staticPage.waitForSelector('.pdf-page');
    assert.deepEqual(JSON.parse(await staticPage.locator('#contract .computation-output').textContent()), answer, `${name} must show the complete answer`);
    assert.equal(await staticPage.locator('#contract').getAttribute('data-phase'), 'complete');
    assert.equal(await staticPage.locator('#contract .kv-entry[data-active="true"]').count(), illustrativeTokens.length - 1);
    await staticPage.close();
  }
  console.log('PASS computation: prefill stages, first token, sequential decoding, KV growth, final-token semantics, replay, cancellation, reentry, reduced motion and print');
} finally {
  await browser.close();
  await server.close();
}
