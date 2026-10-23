import Reveal from 'reveal.js';
import Notes from 'reveal.js/plugin/notes';
import 'reveal.js/reset.css';
import 'reveal.js/reveal.css';
import 'katex/dist/katex.min.css';
import './style.css';
import { slides, sources, illustrativeTokens } from './slides.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLinks = keys => keys.map(key => `<a href="${sources[key][1]}" target="_blank" rel="noreferrer">${sources[key][0]}</a>`).join(' · ');
document.querySelector('.slides').innerHTML = slides.map((s,i) => `<section id="${s.id}" ${!s.appendix&&!s.discussion?'data-main="true"':''} data-timing="${s.seconds}" ${!s.notes?'data-notes-pending="true"':''} aria-label="${escape(s.title)}"><div class="eyebrow">${s.label}</div><${i?'h2':'h1'}>${s.titleHtml || s.title}</${i?'h2':'h1'}><div class="slide-body">${s.body}</div><footer><span>AI THAT DECIDES · Matteo Abis · Nov 3rd 2026 <span class="footer-divider">/</span> ${s.appendix?'APPENDIX':String(i+1).padStart(2,'0')}</span><span>${sourceLinks(s.source)}</span></footer><aside class="notes">${s.notes.split(/\n\n+/).map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}<p>Sources (checked 2026-10-23): ${s.source.length?sourceLinks(s.source):'Presenter’s conceptual explanation or illustrative example; not measured model output.'}</p></aside></section>`).join('');
window.deck = new Reveal({width:1280,height:800,margin:0.04,hash:true,history:true,center:false,transition:'fade',transitionSpeed:'fast',controls:true,progress:true,slideNumber:'c/t',showNotes:new URLSearchParams(location.search).has('handout')?'separate-page':false,pdfSeparateFragments:false,pdfMaxPagesPerSlide:1,plugins:[Notes]});
await window.deck.initialize();

const output = document.querySelector('.token-output');
const generationWindow = document.querySelector('.generation-window');
const generationStatus = document.querySelector('.generation-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const printView = new URLSearchParams(location.search).has('print-pdf');
let generationTimer;
function playGeneration() {
  clearTimeout(generationTimer);
  generationWindow.classList.remove('is-generating');
  if (printView || reducedMotion.matches) {
    output.textContent = illustrativeTokens.join('');
    generationStatus.textContent = 'Complete';
    return;
  }
  if (window.deck.getCurrentSlide().id !== 'mismatch') return;
  output.textContent = '';
  generationStatus.textContent = 'Generating…';
  generationWindow.classList.add('is-generating');
  let index = 0;
  const nextToken = () => {
    output.textContent += illustrativeTokens[index++];
    if (index < illustrativeTokens.length) {
      generationTimer = setTimeout(nextToken, 220);
    } else {
      generationWindow.classList.remove('is-generating');
      generationStatus.textContent = 'Complete';
    }
  };
  generationTimer = setTimeout(nextToken, 200);
}
window.deck.on('slidechanged', playGeneration);
reducedMotion.addEventListener('change', playGeneration);
document.querySelector('[data-replay-generation]').addEventListener('click', playGeneration);
playGeneration();

const computation = document.querySelector('#contract');
const computationOutput = computation.querySelector('.computation-output');
const computationStatus = computation.querySelector('.computation-status');
const prefillStages = [...computation.querySelectorAll('.prefill-stage')];
const cacheEntries = [...computation.querySelectorAll('.kv-entry')];
const cacheCount = computation.querySelector('.cache-count');
let computationTimer;
function setCache(count) {
  cacheEntries.forEach((entry, index) => { entry.dataset.active = String(index < count); });
  cacheCount.textContent = `Prompt + ${count} generated tokens`;
}
function playComputation() {
  clearTimeout(computationTimer);
  if (printView || reducedMotion.matches) {
    computation.dataset.phase = 'complete';
    computationOutput.textContent = illustrativeTokens.join('');
    computationStatus.textContent = 'Complete';
    prefillStages.forEach(stage => { stage.dataset.active = 'true'; });
    setCache(cacheEntries.length);
    return;
  }
  if (window.deck.getCurrentSlide() !== computation) return;
  computation.dataset.phase = 'prefill';
  computationOutput.textContent = '';
  computationStatus.textContent = 'Prefill: processing the full prompt…';
  setCache(0);
  cacheCount.textContent = 'Building prompt cache…';
  let stageIndex = 0;
  let tokenIndex = 1;
  const decodeToken = () => {
    setCache(tokenIndex);
    computationOutput.textContent += illustrativeTokens[tokenIndex++];
    if (tokenIndex < illustrativeTokens.length) {
      computationTimer = setTimeout(decodeToken, 400);
    } else {
      computation.dataset.phase = 'complete';
      computationStatus.textContent = 'Complete';
    }
  };
  const prefillStep = () => {
    prefillStages.forEach((stage, index) => { stage.dataset.active = String(index <= stageIndex); });
    if (stageIndex++ < prefillStages.length) {
      computationTimer = setTimeout(prefillStep, 600);
    } else {
      computation.dataset.phase = 'decode';
      computationOutput.textContent = illustrativeTokens[0];
      computationStatus.textContent = 'Decode: one new token per forward pass…';
      setCache(0);
      computationTimer = setTimeout(decodeToken, 400);
    }
  };
  prefillStep();
}
window.deck.on('slidechanged', playComputation);
reducedMotion.addEventListener('change', playComputation);
computation.querySelector('[data-replay-computation]').addEventListener('click', playComputation);
playComputation();
