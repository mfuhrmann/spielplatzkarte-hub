## 1. Update CI Workflow

- [x] 1.1 Add a step to the `docker` job that reads `package.json` version using `jq` and sets it as a step output (e.g. `APP_VERSION`)
- [x] 1.2 Replace the `type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}` metadata tag with `type=raw,value=latest,enable=${{ startsWith(github.ref, 'refs/tags/v') }}`
- [x] 1.3 Add a `type=raw,value=${{ steps.app_version.outputs.version }}-rc,enable=${{ github.ref == 'refs/heads/main' }}` metadata tag to publish the RC image on main pushes
- [x] 1.4 Verify the SHA tag (`type=sha,prefix=`) is still present so immutable pinning remains available

## 2. Update Documentation

- [x] 2.1 Update the `## Releases` section in `CLAUDE.md` to document that `main` always carries the next minor version and produces `<version>-rc` Docker images
- [x] 2.2 Add a post-release step to the release process in `CLAUDE.md`: after the tag is pushed, open a PR bumping `package.json` to the next minor version (e.g. `0.3.0` → `0.4.0`)
- [x] 2.3 Update the version alignment table in `CLAUDE.md` to note that `package.json` on `main` is always one minor ahead of the last release tag

## 3. Post-Merge Version Bump

- [ ] 3.1 After this change is merged, open a follow-up PR bumping `package.json` from `0.2.1` to `0.3.0` to bring `main` into alignment with the new convention
