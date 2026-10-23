import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import { serveDist } from './serve-dist.mjs';
import { slides as sourceSlides } from '../slides.js';

const target = process.argv[2] || 'handout.pdf';
const server = await serveDist();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(server.url + '/?print-pdf&handout');
  await page.waitForFunction(() => window.deck?.isReady() && document.querySelector('.pdf-page'));
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => [...document.fonts].filter(face => face.family === 'Frutiger' && face.status === 'loaded').length), 2, 'Both local Frutiger weights must load');
  const slides = await page.locator('.pdf-page').count();
  assert.equal(slides, sourceSlides.length, 'Print layout did not produce the complete deck');
  await mkdir(dirname(target), { recursive: true });
  await page.pdf({ path: target, printBackground: true, preferCSSPageSize: true });
  const pdf = await readFile(target);
  assert(pdf.subarray(0, 5).toString() === '%PDF-', 'Invalid PDF');
  const pageCount = Math.max(...[...pdf.toString('latin1').matchAll(/\/Count (\d+)/g)].map(match => Number(match[1])));
  assert.equal(pageCount, slides * 2, 'Handout must include one notes page for every slide');
  console.log(`Exported ${target}: ${pageCount} pages (${slides} slides plus speaker notes)`);
} finally {
  await browser.close();
  await server.close();
}
