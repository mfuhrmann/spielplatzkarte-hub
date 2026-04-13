## Why

Currently `latest` is published on every push to `main`, making it impossible to distinguish stable releases from in-progress work. Users pulling `latest` may unknowingly get unreleased code, and there is no pre-release image available for testing before a formal tag.

## What Changes

- Remove `latest` tag from main-branch pushes; `latest` is now only set when a version tag (`v*`) is pushed.
- Main-branch pushes produce a Docker image tagged `<next-version>-rc` (e.g. `0.3.0-rc`) — no `latest`.
- `package.json` version on `main` must always be one minor version ahead of the latest release tag (e.g. after tagging `v0.2.1`, bump `package.json` to `0.3.0`), signalling that `main` is the RC for the upcoming release.
- Release process is updated: bump `package.json` to the target version just before tagging, then immediately bump to the next minor on `main` after the tag.
- CLAUDE.md is updated to document the new branching/versioning contract so all agents follow it.

## Capabilities

### New Capabilities

- `rc-image-tagging`: CI produces `<version>-rc` Docker images on every push to `main`, derived from the `package.json` version.
- `stable-latest-tagging`: `latest` and semver tags (`X.Y.Z`, `X.Y`) are only published when a `v*` git tag is pushed.

### Modified Capabilities

<!-- No existing spec-level capabilities are changing. -->

## Impact

- `.github/workflows/build.yml` — docker job tag configuration
- `CLAUDE.md` — release process documentation
- `package.json` — version bump required after this change lands (to `0.3.0`)
- No runtime code changes; purely CI and process
