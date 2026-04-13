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

### Version convention

**`main` always carries the next minor version** — one minor bump ahead of the latest release tag.

| State | `package.json` version | Docker image tags produced |
|---|---|---|
| After releasing `v0.2.1`, before next release | `0.3.0-rc` | `0.3.0-rc` (on every push to main) |
| When `v0.3.0` tag is pushed | `0.3.0` at tag time | `0.3.0`, `0.3`, `latest`, `sha-<hash>` |
| After releasing `v0.3.0` | `0.4.0-rc` (bump PR) | `0.4.0-rc` (on every push to main) |

This means:
- **`latest`** always points to the most recent stable release — never to unreleased work.
- **`<version>-rc`** (e.g. `0.3.0-rc`) is the current HEAD of `main` and moves with every push.
- The SHA tag is also always published for immutable pinning.

### Version alignment

| Artifact | Where set | Value |
|---|---|---|
| App UI (shown in footer) | `version` field in `package.json` — imported at runtime by `js/map.js` | Next minor RC version on `main` (e.g. `0.3.0-rc`); release version at tag time |
| Docker image tags | Derived by CI from git tag (semver tags) or `package.json` via `jq` (RC tag) | See table above |
| Git tag | Source of truth for stable releases | Must match the `package.json` version at the moment of tagging (without `-rc`) |

### Release process

```bash
# 1. Create a release branch
git checkout -b chore/release-vX.Y.Z

# 2. Set the exact release version in package.json (strips the -rc suffix)
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
# → CI publishes X.Y.Z, X.Y, and latest to ghcr.io

# 5. Immediately bump main to the next minor RC version
git checkout -b chore/bump-vX.(Y+1).0-rc
npm version X.(Y+1).0-rc --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump version to X.(Y+1).0-rc for next development cycle"
git push -u origin chore/bump-vX.(Y+1).0-rc
gh pr create --title "chore: bump version to X.(Y+1).0-rc"
# → After merge, main pushes will produce X.(Y+1).0-rc images
```

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
