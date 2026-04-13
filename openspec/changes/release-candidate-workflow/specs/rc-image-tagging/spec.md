## ADDED Requirements

### Requirement: Main branch push produces RC-tagged Docker image
The CI pipeline SHALL build and push a Docker image tagged `<version>-rc` on every push to `main`, where `<version>` is the value of the `version` field in `package.json`.

#### Scenario: Push to main produces RC image
- **WHEN** a commit is pushed to the `main` branch
- **THEN** the Docker job builds and pushes an image tagged `<package-json-version>-rc` to `ghcr.io`

#### Scenario: RC tag uses package.json version
- **WHEN** `package.json` contains `"version": "0.3.0"` and a push is made to `main`
- **THEN** the published image tag is exactly `0.3.0-rc`

#### Scenario: RC tag is also published alongside SHA tag
- **WHEN** a commit is pushed to `main`
- **THEN** both the `<version>-rc` tag and the `sha-<hash>` tag are pushed to the registry

### Requirement: package.json version on main is always ahead of latest release
The `package.json` version on `main` SHALL always be set to the next minor version after the most recently published release tag (e.g. after releasing `v0.2.1`, `main` carries `0.3.0`).

#### Scenario: Version on main is bumped after each release
- **WHEN** a release tag `vX.Y.Z` is pushed and a subsequent PR merges into `main`
- **THEN** `package.json` on `main` shows version `X.(Y+1).0`

#### Scenario: RC tag is predictable and meaningful
- **WHEN** an operator wants to test the upcoming release
- **THEN** they can pull `ghcr.io/<image>:<next-minor>-rc` to get the current HEAD of `main`
