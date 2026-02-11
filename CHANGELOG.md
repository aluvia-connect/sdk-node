# Changelog

All notable changes to `@aluvia/sdk` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Overhaul page load detection with weighted scoring system. Replaces binary keyword/status matching with probabilistic signal combination across 8 detector types (HTTP status, WAF headers, title keywords, challenge selectors, visible text, text-to-HTML ratio, redirect chains, meta refresh). Adds two-pass analysis (fast pass at `domcontentloaded`, full pass after `networkidle`), SPA navigation detection, word-boundary matching to prevent false positives, and hostname-level persistent block escalation. Detection results now include `tier` (`blocked`/`suspected`/`clear`), `score`, and `signals` array.
- `onDetection` callback now fires on every page analysis, including `clear` results. Previously only fired for `blocked` and `suspected` tiers.
- Add `autoReload` option to `PageLoadDetectionConfig` (default: `true`). Set to `false` to disable automatic rule updates and page reloads, enabling detection-only mode where agents receive scores via `onDetection` and decide how to respond.

### Removed
- Remove gateway mode (`localProxy: false`). The SDK now always runs a local proxy on `127.0.0.1`. The `localProxy` option has been removed from `AluviaClientOptions`.

## [1.2.0] - 2026-02-11

### Added
- Auto reload a page on block detection. See [docs](https://docs.aluvia.io/aluvia-client/auto-unblock) for details.
- CLI for managing browser sessions: `npx @aluvia/sdk open <url>` and `npx @aluvia/sdk close`.
- Daemon mode: browser runs as a detached background process that survives terminal close.
- CDP (Chrome DevTools Protocol) endpoint exposed via `--remote-debugging-port`, enabling external tools to connect with `connectOverCDP()` and share browser contexts/pages.
- `cdpUrl` field on `AluviaClientConnection` for programmatic CDP access.
- `headless` option on `AluviaClientOptions` (default: `true`). CLI flag `--headed` to launch a visible browser.
- `--connection-id <id>` flag on CLI `open` command to reuse an existing connection.
- Lock file (`/tmp/aluvia-sdk/cli.lock`) for single-instance enforcement with full session metadata.
- JSON output by default on all CLI commands for AI agent consumption.
- `help` command with plain-text output.

### Changed
- Playwright browser launch uses `chromium.launch()` with `--remote-debugging-port` instead of `chromium.launchServer()` + `connect()`, enabling shared browser state across CDP connections.


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

