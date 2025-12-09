// Integration smoke test for Aluvia Agent Connect Client

import { test, mock, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as httpClient from '../src/httpClient';
import { AgentConnectClient } from '../src/AgentConnectClient';
import { MissingUserTokenError, InvalidUserTokenError } from '../src/errors';

// Mock getUser function
const mockGetUser = mock.fn<typeof httpClient.getUser>();

describe('AgentConnectClient', () => {
  beforeEach(() => {
    mockGetUser.mock.resetCalls();
  });

  afterEach(() => {
    mock.reset();
  });

  test('throws MissingUserTokenError when token is not provided', () => {
    assert.throws(
      () => new AgentConnectClient({ token: '' }),
      MissingUserTokenError
    );
  });

  test('can be instantiated with valid token', () => {
    const client = new AgentConnectClient({
      token: 'test-token',
      logLevel: 'silent',
    });
    assert.ok(client);
  });

  test('applies default options correctly', () => {
    // This test verifies defaults are applied (constructor doesn't throw)
    const client = new AgentConnectClient({
      token: 'test-token',
    });
    assert.ok(client);
  });
});

describe('matchPattern', () => {
  // Import the rules module
  const { matchPattern } = require('../src/rules');

  test('* matches any hostname', () => {
    assert.strictEqual(matchPattern('example.com', '*'), true);
    assert.strictEqual(matchPattern('foo.bar.com', '*'), true);
  });

  test('exact match works', () => {
    assert.strictEqual(matchPattern('example.com', 'example.com'), true);
    assert.strictEqual(matchPattern('example.com', 'other.com'), false);
  });

  test('*.example.com matches subdomains', () => {
    assert.strictEqual(matchPattern('foo.example.com', '*.example.com'), true);
    assert.strictEqual(matchPattern('bar.example.com', '*.example.com'), true);
    assert.strictEqual(matchPattern('example.com', '*.example.com'), false);
  });

  test('google.* matches TLD variations', () => {
    assert.strictEqual(matchPattern('google.com', 'google.*'), true);
    assert.strictEqual(matchPattern('google.co.uk', 'google.*'), true);
    assert.strictEqual(matchPattern('notgoogle.com', 'google.*'), false);
  });
});

describe('shouldProxy', () => {
  const { shouldProxy } = require('../src/rules');

  test('empty rules returns false', () => {
    assert.strictEqual(shouldProxy('example.com', []), false);
  });

  test('["*"] proxies everything', () => {
    assert.strictEqual(shouldProxy('example.com', ['*']), true);
    assert.strictEqual(shouldProxy('any.domain.com', ['*']), true);
  });

  test('specific domain only proxies that domain', () => {
    assert.strictEqual(shouldProxy('example.com', ['example.com']), true);
    assert.strictEqual(shouldProxy('other.com', ['example.com']), false);
  });

  test('negative rules exclude hosts', () => {
    assert.strictEqual(shouldProxy('example.com', ['*', '-example.com']), false);
    assert.strictEqual(shouldProxy('other.com', ['*', '-example.com']), true);
  });

  test('AUTO is ignored as placeholder', () => {
    assert.strictEqual(shouldProxy('example.com', ['AUTO']), false);
    assert.strictEqual(shouldProxy('example.com', ['AUTO', 'example.com']), true);
  });
});

describe('Logger', () => {
  const { Logger } = require('../src/logger');

  test('can be instantiated with different log levels', () => {
    const silentLogger = new Logger('silent');
    const infoLogger = new Logger('info');
    const debugLogger = new Logger('debug');

    assert.ok(silentLogger);
    assert.ok(infoLogger);
    assert.ok(debugLogger);
  });
});

describe('Error classes', () => {
  const { MissingUserTokenError, InvalidUserTokenError, ApiError, ProxyStartError } = require('../src/errors');

  test('MissingUserTokenError has correct name', () => {
    const error = new MissingUserTokenError();
    assert.strictEqual(error.name, 'MissingUserTokenError');
  });

  test('InvalidUserTokenError has correct name', () => {
    const error = new InvalidUserTokenError();
    assert.strictEqual(error.name, 'InvalidUserTokenError');
  });

  test('ApiError has correct name and statusCode', () => {
    const error = new ApiError('Test error', 500);
    assert.strictEqual(error.name, 'ApiError');
    assert.strictEqual(error.statusCode, 500);
  });

  test('ProxyStartError has correct name', () => {
    const error = new ProxyStartError();
    assert.strictEqual(error.name, 'ProxyStartError');
  });
});

console.log('All tests defined. Run with: node --test --experimental-strip-types test/integration.test.ts');

