## Context

The project uses `docker/metadata-action` in `.github/workflows/build.yml` to derive Docker image tags. Currently, `latest` is set on every push to `main`, and version tags produce `X.Y.Z`, `X.Y`, and `latest`. The `package.json` version is kept in sync with the git tag but is not used by CI to derive image tags for branch pushes — those currently just get `sha-<hash>`.

The goal is to make `main` always represent the next upcoming release (RC) and `latest` exclusively track stable releases.

## Goals / Non-Goals

**Goals:**
- `latest` is published only from version tag pushes — never from branch pushes.
- Every push to `main` produces a Docker image tagged `<version>-rc`, where `<version>` comes from `package.json`.
- `package.json` on `main` always carries the next version (one minor bump ahead of the last tag), so the RC tag is always predictable and meaningful.
- CLAUDE.md documents the updated release workflow so agents and contributors follow it automatically.

**Non-Goals:**
- No change to how version tags produce `X.Y.Z` and `X.Y` semver tags — that stays as-is.
- No change to PR builds (they already skip Docker).
- No automatic version bumping via CI bots — the bump remains a manual step via PR.

## Decisions

### D1 — Derive RC tag from `package.json`, not git describe

**Choice:** Read the version directly from `package.json` in the CI step and use it as `<version>-rc`.

**Rationale:** `docker/metadata-action` does not have a built-in pattern for "branch push using package.json version". The cleanest approach is a `type=raw` tag with `value` set by reading `package.json` using `jq`. This keeps the tag explicit and avoids brittle shell heuristics like `git describe`.

**Alternative considered:** `type=raw,value={{branch}}-rc` — rejected because it would produce `main-rc`, not the version-qualified `0.3.0-rc` that consumers need.

### D2 — `latest` gating via `enable` flag, not job split

**Choice:** Keep a single `docker` job; use `enable=${{ startsWith(github.ref, 'refs/tags/v') }}` on the `type=raw,value=latest` metadata entry.

**Rationale:** Splitting into separate jobs adds YAML duplication. The `enable` flag in `docker/metadata-action` is the canonical, minimal way to gate a tag.

### D3 — Version bump convention: next minor, not next patch

**Choice:** After releasing `vX.Y.Z`, bump `package.json` to `X.(Y+1).0` on `main`.

**Rationale:** Patch releases (`X.Y.Z+1`) would give an RC tag that looks like a tiny fix, not a development cycle. Minor bumps (`X.Y+1.0`) signal that `main` is working toward a new feature release. Hotfix patch releases can always be cut from a separate branch if needed.

## Risks / Trade-offs

- **RC tag is mutable** — every push to `main` overwrites `0.3.0-rc`. Anyone pinned to that tag will get a moving target. → Mitigation: Document this clearly; users who need immutability should pin the SHA tag (also published).
- **Manual version bump discipline** — if the bump PR is forgotten after a release, `main` will carry a stale version and produce RC tags matching the just-released version. → Mitigation: Add an explicit checklist step to CLAUDE.md; the bump is the first PR opened after a release.
- **`package.json` version ≠ git tag during release PR** — the release PR bumps `package.json` from `0.3.0` to `0.3.0` (no change if already set correctly), but CI on that PR branch still pushes `0.3.0-rc` from the branch. → Acceptable: PR branches don't trigger the docker job.

## Migration Plan

1. Merge the workflow change PR — from this point `main` pushes produce `<version>-rc` and `latest` is no longer updated on main.
2. Immediately open a follow-up PR bumping `package.json` from `0.2.1` → `0.3.0` (no code change needed, just the version field and lockfile).
3. After that PR merges, `main` pushes will produce `0.3.0-rc`.
4. The existing `latest` tag on `ghcr.io` continues to point to `v0.2.1` until a new version tag is pushed — no disruption to existing users.

**Rollback:** Revert the workflow commit. No data is lost; old image tags remain in the registry.

## Open Questions

- Should patch releases still follow `X.Y.(Z+1)` bump on main, or always minor? (Current decision: always minor — revisit if a hotfix workflow is needed.)
