import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { serveDist } from './serve-dist.mjs';
import { slides } from '../slides.js';

const server = await serveDist();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  for (const base of ['/', '/jev-presentation/']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const external = [];
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin !== server.url) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(server.url + base);
    await page.waitForFunction(() => window.deck?.isReady());
    await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => [...document.fonts].filter(face => face.family === 'Frutiger' && face.status === 'loaded').length), 2, 'Both local Frutiger weights must load');
    await page.evaluate(() => window.deck.configure({ transition: 'none' }));
    const count = await page.locator('.slides > section').count();
    assert.equal(count, slides.length, 'Built deck must match the source');
    assert.equal(await page.locator('[data-main]').evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(node.dataset.timing), 0)), slides.filter(slide => !slide.appendix && !slide.discussion).reduce((sum, slide) => sum + slide.seconds, 0));
    assert.equal(await page.locator('#readout .katex').count(), 3, 'Readout formulas must be typeset');
    assert.equal(await page.locator('#readout math').count(), 3, 'Math must expose accessible MathML');
    const ids = await page.locator('.slides > section').evaluateAll(nodes => nodes.map(n => n.id));
    assert.equal(new Set(ids).size, count, 'Slide IDs must be unique');
    assert(ids.every(Boolean), 'All slides need IDs for durable links');
    assert(ids.includes('llm-architecture'), 'Architecture overview must exist');
    assert.equal(ids.indexOf('llm-architecture') + 1, ids.indexOf('contract'), 'Architecture must precede prefill and decode');
    assert.equal(ids.indexOf('read-decision') + 1, ids.indexOf('vocabulary'), 'Vocabulary must follow the recap');
    assert.equal(ids.indexOf('vocabulary') + 1, ids.indexOf('home-prompt'), 'Vocabulary must precede the choice prompt');
    await page.evaluate(() => window.deck.slide(window.deck.getIndices(document.getElementById('llm-architecture')).h));
    const architecture = page.locator('#llm-architecture svg[role="img"]');
    assert.equal(await architecture.count(), 1, 'Architecture needs one accessible diagram');
    assert((await architecture.getAttribute('aria-label')) || (await architecture.locator('title').count()), 'Diagram needs an accessible description');
    const architectureLabels = (await architecture.locator('text').allTextContents()).join(' ');
    for (const label of ['Tokenizer', 'Embeddings', 'Decoder blocks', 'Vocab Score', 'Softmax', 'Sampling', 'Detokenize', 'Causal attention', 'Q', 'K', 'V', 'Feed forward']) {
      assert(architectureLabels.includes(label), `Architecture component missing: ${label}`);
    }
    assert.equal(await architecture.locator('.architecture-residual:not(.legend-line)').count(), 2, 'Decoder block needs both residual paths');
    assert.equal(await architecture.locator('.architecture-add').count(), 2, 'Each residual path must rejoin at an addition');
    assert(await architecture.locator('path.architecture-arrow').count() > 6, 'Diagram must connect the data flow');
    assert.doesNotMatch(await architecture.textContent(), /RMSNorm|final norm|RoPE|SwiGLU|SiLU|MLP|QKᵀ|√d/i, 'Overview must omit normalization and formula jargon');
    for (const concept of [/query/i, /key/i, /value/i, /matrix multiplications/i, /non.linear/i, /stop/i]) {
      assert.match(architectureLabels, concept, 'Overview must explain the operations in plain language');
    }
    const feedback = architecture.locator('path.architecture-feedback');
    assert.equal(await feedback.count(), 1, 'Selected token needs a return path');
    assert.notEqual(await feedback.evaluate(path => getComputedStyle(path).markerEnd), 'none', 'Return path must have a direction');
    const loopConnects = await architecture.evaluate(svg => {
      const nodes = [...svg.querySelectorAll('.architecture-node')];
      const rectFor = label => nodes.find(node => node.querySelector('.architecture-heading')?.textContent === label).querySelector('rect').getBBox();
      const near = (point, box) => point.x >= box.x - 12 && point.x <= box.x + box.width + 12 && point.y >= box.y - 12 && point.y <= box.y + box.height + 12;
      const path = svg.querySelector('.architecture-feedback');
      return near(path.getPointAtLength(0), rectFor('Sampling')) && near(path.getPointAtLength(path.getTotalLength()), rectFor('Embeddings'));
    });
    assert(loopConnects, 'Feedback must return the selected token from Sampling directly to Embeddings');
    for (let index = 0; index < count; index++) {
      await page.evaluate(index => window.deck.slide(index, 0, -1), index);
      const slide = page.locator('.slides > section.present');
      if (await slide.getAttribute('data-notes-pending') === null) {
        assert((await slide.locator('aside.notes').innerText()).length > 80, `Missing notes: ${ids[index]}`);
      }
      const overflow = await slide.evaluate(section => {
        const stage = document.querySelector('.slides').getBoundingClientRect();
        return [...section.querySelectorAll('h1,h2,h3,p,li,pre,table,svg,footer,.bars,.card')].filter(el => {
          if (el.closest('aside') || !el.getClientRects().length) return false;
          const r = el.getBoundingClientRect();
          return r.bottom > stage.bottom + 3 || r.right > stage.right + 3 || r.left < stage.left - 3 || r.top < stage.top - 3;
        }).map(el => el.textContent.trim().slice(0, 80));
      });
      assert.deepEqual(overflow, [], `Overflow on ${ids[index]}`);
      assert.match(await slide.locator('footer').innerText(), /Matteo Abis.*Nov 3rd 2026/, 'Footer must identify the presenter and date');
      const footerOverlap = await slide.evaluate(section => section.querySelector('.slide-body').getBoundingClientRect().bottom > section.querySelector('footer').getBoundingClientRect().top);
      assert.equal(footerOverlap, false, `Body overlaps footer on ${ids[index]}`);
    }
    const links = await page.locator('a[href^="#/"]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
    for (const link of links) assert(ids.includes(link.slice(2)), `Broken slide link: ${link}`);
    await page.evaluate(() => window.deck.slide(0));
    await page.keyboard.press('ArrowRight');
    assert(await page.evaluate(() => window.deck.getIndices().h > 0 || window.deck.getIndices().f >= 0), 'Keyboard navigation failed');
    const fragmentIndex = await page.locator('.slides > section').evaluateAll(nodes => nodes.findIndex(n => n.querySelector('.fragment')));
    if (fragmentIndex >= 0) {
    await page.evaluate(index => window.deck.slide(index, 0, -1), fragmentIndex);
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('.present .fragment.visible').count() > 0, 'Fragment did not advance');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('.present .fragment.visible').count(), 0, 'Fragment did not reverse');
    }
    await page.goto(server.url + base + '#/' + ids[5]);
    await page.reload();
    await page.waitForFunction(id => window.deck?.isReady() && window.deck.getCurrentSlide().id === id, ids[5]);
    const popupPromise = context.waitForEvent('page');
    await page.keyboard.press('s');
    const notes = await popupPromise;
    await notes.waitForLoadState();
    assert((await notes.title()).toLowerCase().includes('speaker'), 'Speaker view failed');
    await notes.waitForFunction(expected => document.querySelector('.speaker-controls-notes')?.textContent.includes(expected), slides[5].notes.split('\n')[0]);
    await notes.close();
    assert.deepEqual(errors, [], 'Browser errors');
    assert.deepEqual(external, [], 'Presentation requires external network');
    console.log(`PASS ${base}: ${count} slides, notes, links, hash refresh, keyboard, fragment reversal, layout, offline assets`);
    if (process.env.SCREENSHOTS && base === '/') {
      await mkdir('artifacts', { recursive: true });
      await page.evaluate(() => window.deck.configure({ transition: 'none' }));
      await page.evaluate(() => document.fonts.ready);
      for (const id of ids) {
        await page.evaluate(id => window.deck.slide(window.deck.getIndices(document.getElementById(id)).h, 0, 99), id);
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.slides > section.present').getAttribute('id'), id);
        await page.screenshot({ path: `artifacts/${id}.png`, animations: 'disabled' });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
