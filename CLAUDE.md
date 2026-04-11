# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies (vite, bootstrap, bootstrap-icons, ol)
npm start            # Dev server at http://localhost:5173
npm run build        # Production build → dist/
npm run serve        # Preview production build locally
npm test             # Run Playwright browser tests (Chromium, Firefox, WebKit)
npx playwright test --project=webkit   # Run tests for one browser only
```

Docker (production-equivalent):
```bash
cp .env.example .env
docker compose up -d --build app   # Rebuild after code changes
# Accessible at http://localhost:8090 (default APP_PORT)
```

No linting is configured. Playwright browsers must be installed once before running tests: `npx playwright install chromium firefox webkit`.

## Architecture

**Spielplatzkarte Hub** is a static federation map that aggregates playgrounds from multiple regional [Spielplatzkarte](https://spielplatzkarte.org) instances onto one OpenLayers map. There is no central database — all data is fetched live from regional instances at runtime via CORS.

### Data Flow

```
registry.json (list of instance URLs)
  → registry.js: fetch /api/rpc/get_meta + /api/rpc/get_playgrounds + /version.json from each instance (parallel)
  → map.js: merge all GeoJSON features → render on OpenLayers map
  → user click → modal iframe opens regional instance at #W{osmId}
```

### Key Files

| File | Purpose |
|---|---|
| `js/map.js` | Core: map init, feature rendering, hover popover, click modal, search, geolocation |
| `js/registry.js` | Loads `registry.json`; fetches meta/playgrounds/version from each regional instance |
| `js/completeness.js` | Scores playground data quality (complete/partial/missing) — mirrors regional app logic |
| `js/config.js` | Runtime config injected by `docker-entrypoint.sh` (MAP_CENTER, MAP_ZOOM, REGISTRY_URL) |
| `public/registry.json` | List of regional Spielplatzkarte instances to aggregate |
| `docker-entrypoint.sh` | Writes env vars to `config.js` on container startup |
| `nginx.conf` | Cache-busting for `registry.json` / `config.js`; SPA fallback |

### Playground Rendering

Features are styled by **access type** (public / private / customers) using OpenLayers fill styles with hatch patterns for restricted access. Completeness score (from `completeness.js`) determines the icon overlay shown in hover popovers.

### Modal / iframe Communication

When a playground is clicked, the regional instance opens in a Bootstrap modal as an iframe. The ESC key is forwarded from the iframe to the parent via `postMessage` so the modal can be closed from within the iframe context.

### Testing

Playwright tests live in `tests/map.spec.ts`. `window.__map` is exposed by `js/map.js` for test access to the OL map instance. Tests mock `registry.json` to return `[]` so no external instance fetches occur. Wheel events are dispatched via `page.evaluate()` on `.ol-viewport` rather than `page.mouse.wheel()` because the latter doesn't reach OL's handler in Playwright's WebKit backend.

### Regional Instance Requirements

Each instance in `registry.json` must:
- Have CORS enabled on `/api/`
- Expose `/api/rpc/get_meta` and `/api/rpc/get_playgrounds`
- Optionally serve `/version.json` (shown in regions panel)

### Tech Stack

- **Vanilla JS** (ES Modules, no framework)
- **OpenLayers 10** — map rendering
- **Bootstrap 5** + Bootstrap Icons — UI, modals, popovers
- **Vite 6** — build tool
- **Nominatim** — geocoding for location search
- **nginx** — serves static files in Docker
