# Contributing to `@aluvia/sdk`

Thank you for your interest in contributing! This guide covers code style, testing expectations, and how to submit changes.

## Requirements

- **Node.js 18+**
- npm (comes with Node.js)

## Local Setup

```bash
# Clone and install
git clone https://github.com/aluvia-connect/sdk-node.git
cd sdk-node
npm ci
```

The `npm ci` command runs `prepare`, which builds the project automatically.

## Project Structure

```
src/
├── index.ts                 # Public SDK exports
├── connect.ts               # connect() helper for CDP sessions
├── errors.ts                # Error classes (ApiError, etc.)
├── proxy-chain.d.ts         # Type declarations for proxy-chain
│
├── api/                     # REST API wrapper (AluviaApi)
│   ├── AluviaApi.ts         # Entry point — namespace wiring
│   ├── request.ts           # Core HTTP transport (requestCore)
│   ├── account.ts           # /account/* endpoint helpers
│   ├── geos.ts              # /geos endpoint helper
│   ├── apiUtils.ts          # Response unwrapping, error mapping
│   └── types.ts             # API response types
│
├── client/                  # SDK core (AluviaClient)
│   ├── AluviaClient.ts      # Main entry point
│   ├── ConfigManager.ts     # Control plane: API config + polling
│   ├── ProxyServer.ts       # Data plane: local proxy (proxy-chain)
│   ├── BlockDetection.ts    # Weighted block/WAF/CAPTCHA scoring
│   ├── rules.ts             # Hostname routing logic (shouldProxy)
│   ├── adapters.ts          # Tool-specific formatters (Playwright, etc.)
│   ├── logger.ts            # Internal logger
│   └── types.ts             # Client types
│
├── session/                 # Session state management (shared)
│   └── lock.ts              # Lock files, process liveness, session list
│
└── bin/                     # CLI (consumes the SDK — never imported by it)
    ├── cli.ts               # Entry point + help
    ├── open.ts              # Daemon: launches browser via AluviaClient
    ├── close.ts             # Graceful session shutdown
    ├── session.ts           # session start/close/list/get/rotate-ip/set-geo/set-rules
    ├── account.ts           # account / account usage
    ├── geos.ts              # geos listing
    └── api-helpers.ts       # Shared CLI utilities (requireApi, resolveSession)
```

**Key boundary:** `bin/` imports from the SDK layers (`client/`, `api/`, `session/`), but no SDK code imports from `bin/`.

## Build

```bash
npm run build
```

Produces three outputs:

- `dist/esm/` — ES Modules
- `dist/cjs/` — CommonJS
- `dist/types/` — TypeScript declarations

The `package.json` exports map handles resolution for both module systems.

## Code Style

### Formatting

- Use **Prettier** for formatting (if configured) or follow existing file conventions.
- Use **2-space indentation** for TypeScript/JavaScript.
- Use **single quotes** for strings.
- Add **trailing commas** in multi-line arrays/objects.

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | `camelCase.ts` or `PascalCase.ts` for classes | `ConfigManager.ts` |
| Classes | `PascalCase` | `AluviaClient` |
| Functions | `camelCase` | `shouldProxy()` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_TIMEOUT_MS` |
| Types/Interfaces | `PascalCase` | `AluviaClientOptions` |

### TypeScript Guidelines

- Prefer **explicit types** for public API surfaces.
- Use `unknown` over `any` where possible.
- Export types from `src/index.ts` if they're part of the public API.
- Keep modules small and single-purpose.

### Error Handling

- Use the existing error classes (`ApiError`, `InvalidApiKeyError`, etc.).
- Fail fast with meaningful messages.
- Never swallow errors silently.

## Testing

Run the test suite before submitting:

```bash
npm test
```

### Test Files

- **`test/integration.test.ts`** — Integration tests for AluviaClient, ConfigManager, AluviaApi, routing rules, ProxyServer, Logger, error classes, Playwright integration, and block detection callbacks.
- **`test/block-detection.test.ts`** — Unit tests for the block detection scoring engine, signal detectors, word-boundary matching, two-pass analysis, and persistent block escalation.

### Running Specific Tests

```bash
# Run block detection tests only
node --import tsx --test test/block-detection.test.ts

# Run tests matching a name pattern
node --import tsx --test --test-name-pattern="AluviaClient" test/integration.test.ts

# Verbose output
node --import tsx --test --test-reporter=spec test/integration.test.ts
```

### Test Requirements

- **All PRs must include tests** for new functionality or bug fixes.
- Cover both happy paths and edge cases.
- Use Node.js built-in test runner (`node:test`).
- Mock external dependencies (API calls, network).

### Writing Tests

Follow the existing patterns in the test files:

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('MyFeature', () => {
  test('does something expected', () => {
    assert.strictEqual(actual, expected);
  });
});
```

## Pull Request Checklist

Before submitting a PR, verify:

- [ ] Code builds without errors: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] New functionality has corresponding tests
- [ ] Public API changes are documented
- [ ] No secrets or API keys in code
- [ ] Commit messages follow the convention (see below)

## Commit Message Policy

We use **Conventional Commits** for clear, automated changelogs.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Maintenance (deps, build, etc.) |

### Examples

```bash
feat(client): add updateTargetGeo() method

fix(rules): handle empty hostname gracefully

docs: update README with installation instructions

chore(deps): bump undici to 6.22.0
```

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the footer:

```
feat(api)!: rename connection_id to connectionId

BREAKING CHANGE: The `connection_id` option is now `connectionId`.
```

## Branch Strategy

- `main` — stable, release-ready code
- `feature/*` — new features
- `fix/*` — bug fixes
- `docs/*` — documentation updates

## Code Review Process

1. Open a PR against `main`.
2. Ensure CI passes (build + tests).
3. Request review from a maintainer.
4. Address feedback and update commits.
5. Squash and merge once approved.

## Release Process

We follow [Semantic Versioning](https://semver.org/): major for breaking changes, minor for new features, patch for bug fixes.

```bash
# 1. Ensure clean state
npm test && npm run build

# 2. Bump version (creates commit + tag)
npm version patch   # or minor / major

# 3. Update CHANGELOG.md, amend the version commit
git add CHANGELOG.md
git commit --amend --no-edit
git tag -f v<version>

# 4. Push and publish
git push origin main && git push origin v<version>
npm publish --access public
```

For pre-release versions: `npm version prerelease --preid=beta` then `npm publish --tag beta --access public`.

## Debugging

```ts
// Enable debug logging
const client = new AluviaClient({
  apiKey: '...',
  logLevel: 'debug',
});

// Test routing rules in isolation
import { shouldProxy } from '@aluvia/sdk/client/rules';
shouldProxy('example.com', ['*', '-google.com']); // true
shouldProxy('google.com', ['*', '-google.com']);   // false
```

## Security

- **Never commit secrets** (API keys, passwords, tokens).
- Use environment variables for sensitive values.
- Report security vulnerabilities privately (see `SECURITY.md`).

## Questions?

Open an issue or reach out to the maintainers. We're happy to help!

