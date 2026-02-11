# Testing Guide

This document covers how to run tests, write new tests, and set up CI for the `@aluvia/sdk` package.

## Quick Start

```bash
# Run all tests
npm test
```

## Test Stack

- **Test Runner:** Node.js built-in test runner (`node:test`)
- **Assertions:** Node.js built-in assertions (`node:assert`)
- **TypeScript:** Executed via `tsx` (no separate compile step)

## Test Commands

### Run All Tests

```bash
npm test
```

This runs:
```bash
node --import tsx --test test/integration.test.ts
```

### Run Page Load Detection Tests

```bash
node --import tsx --test test/page-load-detection.test.ts
```

### Run Specific Test File

```bash
node --import tsx --test test/integration.test.ts
```

### Run Tests with Verbose Output

```bash
node --import tsx --test --test-reporter=spec test/integration.test.ts
```

### Run Tests Matching a Pattern

```bash
node --import tsx --test --test-name-pattern="AluviaClient" test/integration.test.ts
```

## Test Structure

Tests are organized across two files:

- **`test/integration.test.ts`** — Integration tests for AluviaClient, ConfigManager, AluviaApi, routing rules, ProxyServer, Logger, error classes, Playwright integration, and page load detection behavior (onDetection callback, autoReload option, persistent block escalation).
- **`test/page-load-detection.test.ts`** — Unit tests for the page load detection system: scoring engine, signal detectors, word-boundary matching, text-to-HTML ratio, two-pass analysis flow, persistent block escalation, autoReload config, and edge cases.

### `test/integration.test.ts`

Organized by module:

```ts
describe('AluviaClient', () => {
  test('throws MissingApiKeyError when apiKey is not provided', () => {
    // ...
  });
});

describe('ConfigManager polling', () => {
  // ...
});

describe('AluviaApi endpoint helpers', () => {
  // ...
});

describe('matchPattern', () => {
  // ...
});

describe('shouldProxy', () => {
  // ...
});

describe('PageLoadDetection Integration', () => {
  // ...
});
```

### `test/page-load-detection.test.ts`

```ts
describe('Scoring Engine', () => {
  // Probabilistic combination, tier boundaries
});

describe('Signal Detectors', () => {
  // HTTP status, response headers, title keywords,
  // challenge selectors, visible text
});

describe('Word Boundary Matching', () => {
  // "blocked" matches "you are blocked" but not "blockchain"
});

describe('Text-to-HTML Ratio', () => {
  // Fires when html >= 1000 bytes, skips small pages
});

describe('Two-Pass Flow', () => {
  // Fast pass, full pass merging, SPA analysis
});

describe('Persistent Block Escalation', () => {
  // retriedUrls and persistentHostnames tracking
});

describe('Edge Cases', () => {
  // Null response, evaluate failures, disabled detection
});

describe('Structured Debug Logging', () => {
  // JSON output format verification
});
```

## Test Categories

### Unit Tests

Test individual functions in isolation:

```ts
describe('matchPattern', () => {
  test('* matches any hostname', () => {
    assert.strictEqual(matchPattern('example.com', '*'), true);
  });

  test('exact match works', () => {
    assert.strictEqual(matchPattern('example.com', 'example.com'), true);
    assert.strictEqual(matchPattern('example.com', 'other.com'), false);
  });
});
```

### Integration Tests

Test module interactions with mocked dependencies:

```ts
describe('AluviaClient', () => {
  test('connection includes proxy adapter helpers', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
    });

    // Mock internal dependencies
    (client as any).configManager.init = async () => {};
    (client as any).proxyServer.start = async () => ({
      host: '127.0.0.1',
      port: 54321,
      url: 'http://127.0.0.1:54321',
    });

    const connection = await client.start();
    assert.strictEqual(connection.url, 'http://127.0.0.1:54321');

    await connection.close();
  });
});
```

### API Tests

Test HTTP client behavior with mocked `fetch`:

```ts
describe('requestCore', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('sends If-None-Match when provided', async () => {
    globalThis.fetch = async (url, init) => {
      // Verify request
      assert.strictEqual(init.headers['If-None-Match'], '"etag-prev"');
      
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { ETag: '"etag-new"' },
      });
    };

    await requestCore({
      apiBaseUrl: 'https://api.aluvia.io/v1',
      apiKey: 'test',
      method: 'GET',
      path: '/account',
      ifNoneMatch: '"etag-prev"',
    });
  });
});
```

## Writing Tests

### Test Template

```ts
import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

describe('MyModule', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    mock.reset();
  });

  test('does something expected', () => {
    const result = myFunction('input');
    assert.strictEqual(result, 'expected');
  });

  test('handles edge cases', () => {
    assert.throws(
      () => myFunction(null),
      { name: 'TypeError' }
    );
  });

  test('async operations work', async () => {
    const result = await myAsyncFunction();
    assert.ok(result);
  });
});
```

### Mocking Patterns

**Mock fetch globally:**

```ts
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('handles API response', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ success: true, data: {} }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

  // Test code that uses fetch
});
```

**Mock class methods:**

```ts
test('mocks internal methods', async () => {
  const client = new AluviaClient({ apiKey: 'test' });
  
  (client as any).configManager.init = async () => {};
  (client as any).proxyServer.start = async () => ({ url: 'http://127.0.0.1:8080' });

  await client.start();
});
```

### Assertion Patterns

```ts
// Strict equality
assert.strictEqual(actual, expected);

// Deep equality for objects/arrays
assert.deepStrictEqual(actual, expected);

// Truthiness
assert.ok(value);

// Throws
assert.throws(() => fn(), ErrorClass);
assert.throws(() => fn(), { name: 'ErrorName', message: /pattern/ });

// Async throws
await assert.rejects(asyncFn(), ErrorClass);
await assert.rejects(asyncFn(), (err) => {
  assert.ok(err instanceof ApiError);
  assert.strictEqual(err.statusCode, 500);
  return true;
});
```

## Integration Tests with Staging

For tests that require a real Aluvia API connection:

### Setup

```bash
# Set environment variables
export ALUVIA_API_KEY="your-staging-api-key"
export ALUVIA_API_BASE_URL="https://api.staging.aluvia.io/v1"
```

### Example Staging Test

```ts
// test/staging.test.ts (not run in CI by default)
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { AluviaClient } from '../src/index.js';

const apiKey = process.env.ALUVIA_API_KEY;

describe('Staging Integration', { skip: !apiKey }, () => {
  test('can create and use a connection', async () => {
    const client = new AluviaClient({
      apiKey: apiKey!,
      apiBaseUrl: process.env.ALUVIA_API_BASE_URL,
    });

    const connection = await client.start();
    assert.ok(connection.url.startsWith('http://127.0.0.1:'));

    await connection.close();
  });
});
```

### Run Staging Tests

```bash
ALUVIA_API_KEY=<key> node --import tsx --test test/staging.test.ts
```

## CI Configuration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20, 22]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Test
        run: npm test

  staging-test:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: test
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - name: Run staging tests
        run: node --import tsx --test test/staging.test.ts
        env:
          ALUVIA_API_KEY: ${{ secrets.ALUVIA_STAGING_API_KEY }}
          ALUVIA_API_BASE_URL: https://api.staging.aluvia.io/v1
```

### CI Job Matrix

| Job | Node Versions | Trigger | Secrets Required |
|-----|---------------|---------|------------------|
| `test` | 18, 20, 22 | All PRs, pushes | None |
| `staging-test` | 20 | Push to main | `ALUVIA_STAGING_API_KEY` |

## Test Coverage

To generate coverage reports (requires additional setup):

```bash
# Install c8 for coverage
npm install -D c8

# Run with coverage
npx c8 npm test

# Generate HTML report
npx c8 --reporter=html npm test
```

Add to `package.json`:

```json
{
  "scripts": {
    "test:coverage": "c8 npm test"
  }
}
```

## Debugging Tests

### Run single test with more output

```bash
node --import tsx --test --test-reporter=spec test/integration.test.ts
```

### Add console output

```ts
test('debug this test', () => {
  console.log('Debug:', someValue);
  assert.ok(someValue);
});
```

### Use Node.js debugger

```bash
node --import tsx --inspect-brk --test test/integration.test.ts
```

Then attach VS Code or Chrome DevTools.

## Best Practices

1. **Isolate tests** — Each test should be independent
2. **Clean up** — Use `afterEach` to reset mocks and state
3. **Descriptive names** — Test names should describe behavior
4. **Test edge cases** — Empty inputs, null values, errors
5. **Fast tests** — Mock I/O, avoid real network calls in unit tests
6. **Avoid flaky tests** — Don't depend on timing or external state

