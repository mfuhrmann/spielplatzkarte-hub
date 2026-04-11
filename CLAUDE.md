# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make install          # Install npm dependencies
make dev              # Start Vite dev server at http://localhost:5173
make build            # Production build → dist/
make serve            # Preview production build locally
make install-browsers # Install Playwright browsers (first time only)
make test             # Run browser tests (Chromium, Firefox, WebKit)
make clean            # Remove dist/
make help             # List all available targets
```

Single-browser test run:
```bash
npx playwright test --project=webkit
```

Docker:
```bash
cp .env.example .env
make docker-up        # Start container (http://localhost:8090)
make docker-build     # Rebuild image after code changes
make docker-down      # Stop container
```

No linting is configured.

## Git Workflow

**Never push directly to `main`.** All changes go through a feature branch and pull request.

**Never create branches on upstream/forked repositories.** Branches are only created on this repository (`mfuhrmann/spielplatzkarte-hub`).

```bash
git checkout -b <type>/short-description   # branch off main
# ... make changes ...
git push -u origin <type>/short-description
gh pr create                               # open PR targeting main
```

### Commit messages — Conventional Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[optional scope]: <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`

- Breaking changes: append `!` after type/scope, or add `BREAKING CHANGE:` footer
- Body and footers are optional; use them when the why isn't obvious

## Releases

Releases are driven by **git version tags**. The tag triggers the CI pipeline which builds and pushes Docker images.

### Version alignment

Three things must always show the same version number:

| Artifact | Where set |
|---|---|
| App UI (shown in footer) | `version` field in `package.json` — imported at runtime by `js/map.js` |
| Docker image tags | Derived automatically from the git tag by `docker/metadata-action` in CI |
| Git tag | Source of truth — must match `package.json` |

### Release process

```bash
# 1. Create a release branch
git checkout -b chore/release-vX.Y.Z

# 2. Bump the version in package.json
npm version X.Y.Z --no-git-tag-version

# 3. Commit and open a PR
git add package.json package-lock.json
git commit -m "chore(release): vX.Y.Z"
git push -u origin chore/release-vX.Y.Z
gh pr create --title "chore(release): vX.Y.Z"

# 4. After the PR is merged, tag main
git checkout main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

Pushing the tag triggers the `docker` CI job which publishes images tagged `X.Y.Z`, `X.Y`, and `latest` to `ghcr.io`.

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
