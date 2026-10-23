# AI That Decides

**Jev, System One Models, and the Architecture of Fast Decisions**

Matteo Abis · 3 November 2026

A Reveal.js presentation for engineers with mixed ML experience: 30 main slides allocated 40 minutes, five minutes of discussion, and a linked source appendix. Sources checked 23 October 2026.

## Present and see speaker notes

Open the [published presentation](https://enucatl.github.io/jev-presentation/).

- Arrow keys or Space advance; Left reverses fragments.
- **S opens the speaker view** in a separate window: current slide, next slide, notes and timer. Allow popups if prompted. Keep the original window on the audience display and the speaker window on your own screen.
- Escape opens the slide overview; F enters fullscreen.
- Named slide links work directly, for example `#/reasoning-benchmark`.
- For a standalone notes document, read [NOTES.md](NOTES.md).
- [handout.pdf](handout.pdf) contains slides with separate notes pages.

Open speaker view from the presentation with S; opening its internal HTML file directly does not connect it to the deck. Notes are part of the static presentation and are public.

## Local preview

The removable Docker preview is at **http://aperture.home.arpa:4173**. Instructions to rebuild, restart and remove it are in [AGENTS.md](AGENTS.md).

For ordinary Node development (Node >=22.12):

```sh
npm ci
npm run dev
```

Production:

```sh
npm run build
npm run preview
```

Serve `dist/` over HTTP, rather than opening a file URL. Vite uses `base: './'`, and Reveal uses hash navigation, so the build works at both the domain root and a project subpath. Assets, fonts, diagrams and speaker notes are bundled locally. External source links need internet; the deck itself needs no backend or API credentials.

## Build, verify and export in disposable Docker

Dependencies and temporary files stay inside the container. Only the build, notes and PDF are copied back.

```sh
docker run --rm --userns=host --ipc=host \
  --env PREVIEW_UID="$(id -u)" --env PREVIEW_GID="$(id -g)" \
  --mount type=bind,src="$PWD",dst=/source \
  mcr.microsoft.com/playwright:v1.64.0-noble \
  bash -lc 'mkdir /tmp/deck && cp -a /source/. /tmp/deck/ && cd /tmp/deck && npm ci && npm test && node scripts/export-notes.mjs && npm run build && npm run verify && npm run handout && mkdir -p /source/dist && cp -a dist/. /source/dist/ && cp handout.pdf NOTES.md /source/ && chown -R "$PREVIEW_UID:$PREVIEW_GID" /source/dist /source/handout.pdf /source/NOTES.md'
```

Checks cover fixture validation, slide timing and notes, root/subpath hosting, offline assets, navigation, speaker view, layout and animations. PDF export verifies one slide page and one notes page per slide. The 40-minute allocation still needs a spoken rehearsal.

To print manually, open `?print-pdf&handout` before the slide hash. Print landscape with background graphics and no margins. Omit `&handout` for slides without notes.

## GitHub Pages

[.github/workflows/pages.yml](.github/workflows/pages.yml) builds with `npm ci` and `npm run build`, then publishes `dist` on pushes to `main`. It can also be launched manually from Actions. The repository's Pages source must be **GitHub Actions**.

## GitLab Pages

[.gitlab-ci.yml](.gitlab-ci.yml) builds branches and publishes `dist` from the default branch. After importing the repository into GitLab, a default-branch pipeline deploys it when a runner and Pages are available. The `pages.publish` syntax requires GitLab 17.9 or later. Find the resulting URL under **Deploy → Pages**; no hardcoded hostname or project path needs changing.

## Content and provenance

- `slides.js`: slide content, diagrams, sources, timings and notes.
- `main.js` and `style.css`: rendering and animations.
- [Architecture evidence](references/architecture.md): AutoTrust code at revision `14b425269ed24452e0a5ad5a8f3e51d139647a88`.
- [Benchmark evidence](references/benchmarks.md): pinned S1MB results and the separate reasoning comparison.
- [TypeSafe source record](references/typesafe.md): documentation and practical examples.
- [Generated recap image](references/recap-image.md): image provenance.

The transaction JSON animation uses staged token chunks, not measured model output. Reduced-motion mode and PDF export show the completed JSON.

## Optional API capture tooling

The finance fixture remains **awaiting capture**; it contains no invented model response. The current slides use conceptual examples, not a live replay of this fixture.

To capture real responses, provide `TYPESAFE_API_KEY` through the environment:

```sh
npm run capture
node scripts/validate-fixtures.mjs
```

The script submits the finance request, validates returned model identity and distributions, then writes the fixture and a timestamped archive. It pins Jev 1.13.0 and does not store authentication headers. Errors preserve the existing fixture. No model weights are hosted.

## Visual style

Palette and typography follow [UBS Switzerland](https://www.ubs.com/ch/en.html): locally bundled Frutiger, white, charcoal, warm grey and red. See [font attribution](assets/fonts/README.md).
