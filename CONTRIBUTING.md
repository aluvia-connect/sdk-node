# Contributing to `@aluvia/sdk`

Thank you for your interest in contributing! This guide covers code style, testing expectations, and how to submit changes.

## Requirements

- **Node.js 18+**
- npm (comes with Node.js)

## Local Setup

```bash
# Clone and install
git clone https://github.com/aluvia/aluvia-sdk.git
cd aluvia-sdk
npm ci
```

The `npm ci` command runs `prepare`, which builds the project automatically.

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

### Test Requirements

- **All PRs must include tests** for new functionality or bug fixes.
- Cover both happy paths and edge cases.
- Use Node.js built-in test runner (`node:test`).
- Mock external dependencies (API calls, network).

### Writing Tests

Tests live in `test/integration.test.ts`. Follow the existing patterns:

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

## Security

- **Never commit secrets** (API keys, passwords, tokens).
- Use environment variables for sensitive values.
- Report security vulnerabilities privately (see `SECURITY.md`).

## Questions?

Open an issue or reach out to the maintainers. We're happy to help!

