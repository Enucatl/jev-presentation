# Repository instructions

## Speaker notes and handout

Matteo authorized the final notes pass on 23 October 2026. Keep speaker notes simple, clear and straightforward. When slide content or notes change, update the matching notes, regenerate `NOTES.md`, and refresh `handout.pdf` from the production build. Do not expand notes into a dense script.

## Slide copy

Do not add routine disclaimers to slides identifying examples as fictional, illustrative, or not API captures, or captions such as “Illustrative probabilities” and “Token rates, not cost per correct decision.” These labels are not necessary for this presentation. Keep provenance in fixtures and reference documentation; do not describe invented examples as recorded model responses. Keep slide copy focused on the concept being taught.

## Temporary Docker preview after every edit turn

After every turn that changes this repository, rebuild and relaunch the Reveal.js preview before reporting completion. This also applies to content, notes, style, and documentation edits. Keep the preview at **http://aperture.home.arpa:4173**. Do not ask for permission to refresh it.

Use disposable containers with `docker run --rm --userns=host`. Keep dependencies and temporary test files inside the container; do not install them on the host or create persistent Docker volumes. Export only the requested build, notes, and PDF deliverables. Run relevant checks for the actual change; do not repeat unrelated tests merely to restart the preview.

For a complete check and build, from the repository root:

```sh
docker run --rm --userns=host --ipc=host \
  --env PREVIEW_UID="$(id -u)" --env PREVIEW_GID="$(id -g)" \
  --mount type=bind,src="$PWD",dst=/source \
  mcr.microsoft.com/playwright:v1.64.0-noble \
  bash -lc 'mkdir /tmp/deck && cp -a /source/. /tmp/deck/ && cd /tmp/deck && npm ci && npm test && node scripts/export-notes.mjs && npm run build && npm run verify && npm run handout && mkdir -p /source/dist && cp -a dist/. /source/dist/ && cp handout.pdf NOTES.md /source/ && chown -R "$PREVIEW_UID:$PREVIEW_GID" /source/dist /source/handout.pdf /source/NOTES.md'
```

When only documentation changes, `npm ci && npm run build` in the same disposable setup is sufficient; copy the rebuilt `dist` back. When slides, styles, or notes change, refresh the handout and notes too. For commands expected to take more than 30 seconds in the main thread, follow the installed `wake-run` skill. Subagents run their own long commands directly and report completion.

After a successful build, stop the existing preview if present, then launch its replacement:

```sh
if docker container inspect jev-presentation-preview >/dev/null 2>&1; then
  docker stop jev-presentation-preview
fi

docker run --detach --rm --init --userns=host \
  --name jev-presentation-preview \
  --publish 4173:4173 \
  --mount type=bind,src="$PWD/dist",dst=/deck,readonly \
  --mount type=bind,src="$PWD/scripts",dst=/scripts,readonly \
  node:22-alpine node --input-type=module -e \
  'import { serveDist } from "/scripts/serve-dist.mjs"; await serveDist("/deck", { host: "0.0.0.0", port: 4173 });'

curl --fail --silent --show-error --retry 3 --retry-connrefused http://aperture.home.arpa:4173/
```

The container must have `--rm` so stopping it removes it automatically. Mount the built deck and server scripts read-only; publish port 4173 on the host interfaces so the preview is reachable via `aperture.home.arpa` from the home network. Do not bind the published port only to loopback. Report the preview URL after confirming it responds. To stop and remove the preview:

```sh
docker stop jev-presentation-preview
```
