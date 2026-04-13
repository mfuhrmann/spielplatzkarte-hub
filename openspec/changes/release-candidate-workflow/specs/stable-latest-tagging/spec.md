## ADDED Requirements

### Requirement: latest tag is only published from version tags
The CI pipeline SHALL publish the `latest` Docker image tag exclusively when a `v*` git tag is pushed. Pushes to `main` or any other branch SHALL NOT update `latest`.

#### Scenario: Version tag push publishes latest
- **WHEN** a tag matching `v*` is pushed to the repository
- **THEN** the Docker job publishes an image tagged `latest` to `ghcr.io`

#### Scenario: Main branch push does not update latest
- **WHEN** a commit is pushed to `main`
- **THEN** no image tagged `latest` is pushed to the registry

#### Scenario: Version tag also publishes semver tags
- **WHEN** a tag `vX.Y.Z` is pushed
- **THEN** the Docker job pushes images tagged `X.Y.Z`, `X.Y`, `latest`, and `sha-<hash>`

### Requirement: latest always points to the most recent stable release
The `latest` tag in `ghcr.io` SHALL always correspond to the most recently pushed `v*` git tag, and SHALL never point to unreleased or in-progress work.

#### Scenario: latest is stable after a release
- **WHEN** `vX.Y.Z` is tagged and pushed
- **THEN** `docker pull ghcr.io/<image>:latest` returns the image built from that tag

#### Scenario: latest is not moved by RC or PR activity
- **WHEN** multiple commits are pushed to `main` after a release
- **THEN** `latest` continues to point to the most recent stable release tag
