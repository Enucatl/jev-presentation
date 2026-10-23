import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { serveDist } from './serve-dist.mjs';

const answer = { source_of_wealth: 'business', confidence: 'high' };
const server = await serveDist();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const external = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== server.url) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(server.url + '/#/mismatch');
  await page.waitForFunction(() => window.deck?.isReady());
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.deck.configure({ transition: 'none' }));
  const output = page.locator('#mismatch .token-output');
  const replay = page.locator('#mismatch [data-replay-generation]');
  await replay.click();
  await page.clock.runFor(250);
  const partial = await output.textContent();
  assert(partial.length > 0 && !partial.includes('high'), 'Expected an incomplete, progressively generated answer');
  await page.clock.runFor(10000);
  const completed = await output.textContent();
  assert.deepEqual(JSON.parse(completed), answer);

  await replay.click();
  assert((await output.textContent()).length < completed.length, 'Replay must restart generation');
  await page.clock.runFor(250);
  await page.evaluate(() => window.deck.slide(window.deck.getIndices(document.getElementById('start')).h));
  const stopped = await output.textContent();
  await page.clock.runFor(10000);
  assert.equal(await output.textContent(), stopped, 'Generation must stop off-slide');
  await page.evaluate(() => window.deck.slide(window.deck.getIndices(document.getElementById('mismatch')).h));
  assert((await output.textContent()).length < completed.length, 'Reentry must restart generation');
  await page.clock.runFor(10000);
  assert.deepEqual(JSON.parse(await output.textContent()), answer);
  assert.match(await page.locator('#start').innerText(), /Matteo Abis/);
  assert.doesNotMatch(await page.locator('#start .slide-body').innerText(), /state.*probabilities.*action/si);
  assert.match(await page.locator('#mismatch').innerText(), /Mr Example/);
  assert.match(await page.locator('#mismatch').innerText(), /Test Corp/);

  if (process.env.SCREENSHOTS) {
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/mismatch.png', animations: 'disabled' });
  }
  assert.deepEqual(external, [], 'Intro animation requires external resources');
  await context.close();

  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(server.url + '/#/mismatch');
  await reduced.waitForFunction(() => window.deck?.isReady());
  assert.deepEqual(JSON.parse(await reduced.locator('#mismatch .token-output').textContent()), answer, 'Reduced-motion mode must show the final answer');
  await reduced.close();

  const print = await browser.newPage();
  await print.goto(server.url + '/?print-pdf');
  await print.waitForFunction(() => window.deck?.isReady() && document.querySelector('.pdf-page'));
  assert.deepEqual(JSON.parse(await print.locator('#mismatch .token-output').textContent()), answer, 'PDF must include the complete answer');
  await print.close();
  console.log('PASS intro: progressive JSON, replay, cancellation, reentry, reduced motion, print, offline assets, title and scenario');
} finally {
  await browser.close();
  await server.close();
}
