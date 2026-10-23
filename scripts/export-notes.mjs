import { writeFile } from 'node:fs/promises';
import { slides, sources } from '../slides.js';
const content = ['# AI That Decides — speaker notes', '', '40 minutes of content, then 5 minutes of discussion. Source snapshot: 2026-10-23. All conceptual numeric examples are illustrative; only fixtures with captured status are API recordings.', '', ...slides.flatMap((slide, i) => [`## ${i+1}. ${slide.title}`, '', `Slide: #/${slide.id} · ${slide.appendix ? 'Appendix' : `${slide.seconds} seconds`}`, '', slide.notes, '', ...slide.source.map(key => `- [${sources[key][0]}](${sources[key][1]})`), ''])].join('\n');
await writeFile(new URL('../NOTES.md', import.meta.url), content.trimEnd()+'\n');
console.log('Wrote NOTES.md from the same notes used in the deck.');
