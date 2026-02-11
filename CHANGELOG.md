# Changelog

All notable changes to `@aluvia/sdk` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- Remove gateway mode (`localProxy: false`). The SDK now always runs a local proxy on `127.0.0.1`. The `localProxy` option has been removed from `AluviaClientOptions`.

## [1.2.0] - 2026-02-11

### Added
- Auto reload a page on block detection. See [docs](https://docs.aluvia.io/aluvia-client/auto-unblock) for details.


## [1.1.0] - 2026-01-26

### Added
- Option for the client to launch Playwright browser instances directly with built-in proxy settings.


## [1.0.0] - 2025-01-12

### Added
- Initial release of `@aluvia/sdk`
- `AluviaClient` — main entry point for SDK
- Client proxy mode (default) — local proxy on `127.0.0.1`
- Gateway mode — direct gateway proxy settings
- `connection.asPlaywright()` — Playwright proxy configuration
- `connection.asPuppeteer()` — Puppeteer proxy arguments
- `connection.asSelenium()` — Selenium proxy arguments
- `connection.asAxiosConfig()` — Axios HTTP client configuration
- `connection.asGotOptions()` — Got HTTP client configuration
- `connection.asNodeAgents()` — Node.js HTTP/HTTPS agents
- `connection.asUndiciDispatcher()` — Undici dispatcher
- `connection.asUndiciFetch()` — Fetch function via Undici
- `client.updateRules()` — update routing rules at runtime
- `client.updateSessionId()` — update upstream session
- `client.updateTargetGeo()` — update geo targeting
- `AluviaApi` — typed wrapper for Aluvia REST API
- Hostname-based routing rules with wildcard support
- ETag-based config polling for live updates
- Error classes: `MissingApiKeyError`, `InvalidApiKeyError`, `ApiError`, `ProxyStartError`

---

## Changelog Policy

### When to Update

Update this changelog for **every release**. Add entries to `[Unreleased]` during development.

### Categories

Use these categories (in order):

| Category | Description |
|----------|-------------|
| **Added** | New features |
| **Changed** | Changes to existing functionality |
| **Deprecated** | Features that will be removed |
| **Removed** | Features that were removed |
| **Fixed** | Bug fixes |
| **Security** | Security vulnerability fixes |

### Entry Format

Each entry should:
- Start with a verb (Add, Fix, Change, Remove, etc.)
- Be concise but descriptive
- Reference issues/PRs when relevant

**Good:**
```markdown
- Add `updateTargetGeo()` method for geo targeting (#42)
- Fix hostname extraction for origin-form URLs
- Change default poll interval from 10s to 5s
```

**Bad:**
```markdown
- updateTargetGeo
- Fixed bug
- Changes
```

### Release Process

1. Move entries from `[Unreleased]` to new version section
2. Add release date
3. Commit changelog with version bump
4. Tag release

### Conventional Commits

We use Conventional Commits for commit messages. The changelog can be auto-generated from commits:

```bash
# Install standard-version (optional)
npm install -D standard-version

# Generate changelog from commits
npx standard-version
```

Commit types map to changelog categories:

| Commit Type | Changelog Category |
|-------------|-------------------|
| `feat:` | Added |
| `fix:` | Fixed |
| `perf:` | Changed |
| `refactor:` | Changed |
| `docs:` | (usually not included) |
| `chore:` | (usually not included) |
| `BREAKING CHANGE:` | Changed (major version) |

### Version Links

At the bottom of the file, add comparison links:

```markdown
[Unreleased]: https://github.com/aluvia-connect/sdk-node/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aluvia-connect/sdk-node/releases/tag/v1.0.0
```

---

[Unreleased]: https://github.com/aluvia-connect/sdk-node/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aluvia-connect/sdk-node/releases/tag/v1.0.0

