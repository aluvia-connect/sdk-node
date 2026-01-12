# Release Process

This document describes how to publish new versions of `@aluvia/sdk` to npm and update documentation.

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (`X.0.0`): Breaking changes to public API
- **MINOR** (`0.X.0`): New features, backward compatible
- **PATCH** (`0.0.X`): Bug fixes, backward compatible

## Pre-Release Checklist

Before releasing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] `CHANGELOG.md` is updated
- [ ] No uncommitted changes in working directory
- [ ] You're on the `main` branch
- [ ] `main` is up-to-date with remote

## Release Steps

### 1. Update Version

```bash
# For patch release (bug fixes)
npm version patch

# For minor release (new features)
npm version minor

# For major release (breaking changes)
npm version major
```

This command:
- Updates `version` in `package.json`
- Creates a git commit
- Creates a git tag (`v1.2.3`)

### 2. Update Changelog

Edit `CHANGELOG.md` to document changes under the new version:

```markdown
## [1.2.3] - 2025-01-15

### Added
- New `updateTargetGeo()` method for geo targeting

### Fixed
- Fixed hostname extraction for origin-form URLs

### Changed
- Improved error messages for API failures
```

Commit the changelog update:

```bash
git add CHANGELOG.md
git commit --amend --no-edit
git tag -f v1.2.3
```

### 3. Push to Remote

```bash
git push origin main
git push origin v1.2.3
```

### 4. Publish to npm

```bash
npm publish --access public
```

For scoped packages (`@aluvia/sdk`), the `--access public` flag is required for public visibility.

### 5. Create GitHub Release

1. Go to the repository's **Releases** page.
2. Click **Draft a new release**.
3. Select the tag (`v1.2.3`).
4. Title: `v1.2.3`
5. Description: Copy from `CHANGELOG.md`
6. Click **Publish release**.

## Documentation Site Versioning

The documentation site at `docs.aluvia.io` supports versioned docs.

### Update Documentation

1. Update relevant docs in `/docs/` directory.
2. Ensure code examples match the new version.
3. Update API reference if endpoints changed.

### Docusaurus Versioning (if applicable)

If using Docusaurus for `docs.aluvia.io`:

```bash
# Create a versioned snapshot
npm run docusaurus docs:version 1.2.3
```

This creates:
- `versioned_docs/version-1.2.3/` — snapshot of current docs
- `versioned_sidebars/version-1.2.3-sidebars.json` — sidebar config
- Updates `versions.json` with the new version

### Version Dropdown

Users can switch versions via the documentation site's version dropdown. Keep the last 3-5 major/minor versions available.

## Hotfix Process

For urgent fixes to a released version:

```bash
# Create hotfix branch from tag
git checkout -b hotfix/1.2.4 v1.2.3

# Make fixes, commit
git commit -m "fix: critical bug in routing"

# Update version
npm version patch

# Merge back to main
git checkout main
git merge hotfix/1.2.4

# Publish
npm publish --access public
```

## Pre-Release Versions

For beta/alpha releases:

```bash
# Beta release
npm version prerelease --preid=beta
# Results in: 1.2.3-beta.0

# Publish with tag
npm publish --tag beta --access public
```

Users install with:

```bash
npm install @aluvia/sdk@beta
```

## Rollback

If a release has critical issues:

### Deprecate on npm

```bash
npm deprecate @aluvia/sdk@1.2.3 "Critical bug, please upgrade to 1.2.4"
```

### Unpublish (within 72 hours)

```bash
npm unpublish @aluvia/sdk@1.2.3
```

**Note:** Unpublishing is only possible within 72 hours of publish and if no other packages depend on it.

## Release Automation (Future)

Consider setting up GitHub Actions for automated releases:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Checklist Summary

```
□ Tests pass
□ Build succeeds
□ CHANGELOG.md updated
□ Version bumped (npm version)
□ Tag pushed
□ Published to npm
□ GitHub release created
□ Documentation updated
□ Docs site version created (if major/minor)
```

