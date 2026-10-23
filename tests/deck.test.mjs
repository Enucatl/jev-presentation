import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slides } from '../slides.js';

test('current draft has valid slides without the removed later deck', () => {
  assert.equal(new Set(slides.map(slide => slide.id)).size, slides.length);
  assert(slides.every(slide => Number.isFinite(slide.seconds) && slide.seconds > 0));
  assert.deepEqual(slides.filter(slide => slide.appendix).map(slide => slide.id), ['source-appendix']);
  for (const id of ['score', 'brier', 'confidence', 'references', 'replay']) {
    assert(!slides.some(slide => slide.id === id), `Removed slide returned: ${id}`);
  }
});

test('speaker notes cover the deck and main timing is forty minutes', () => {
  assert(slides.every(slide => slide.notes.trim().length > 80));
  assert.equal(slides.filter(slide => !slide.appendix && !slide.discussion).reduce((sum, slide) => sum + slide.seconds, 0), 40 * 60);
});
