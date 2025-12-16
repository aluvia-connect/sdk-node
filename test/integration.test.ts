// Integration smoke test for Aluvia Client

import { test, mock, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as httpClient from '../src/httpClient.js';
import { AluviaClient } from '../src/AluviaClient.js';
import {
  MissingConnectionTokenError,
  InvalidConnectionTokenError,
  ApiError,
  ProxyStartError,
} from '../src/errors.js';
import { matchPattern, shouldProxy } from '../src/rules.js';
import { Logger } from '../src/logger.js';

// Mock getConnection function
const mockGetConnection = mock.fn<typeof httpClient.getConnection>();

describe('AluviaClient', () => {
  beforeEach(() => {
    mockGetConnection.mock.resetCalls();
  });

  afterEach(() => {
    mock.reset();
  });

  test('throws MissingConnectionTokenError when token is not provided', () => {
    assert.throws(
      () => new AluviaClient({ token: '' }),
      MissingConnectionTokenError
    );
  });

  test('can be instantiated with valid token', () => {
    const client = new AluviaClient({
      token: 'test-token',
      logLevel: 'silent',
    });
    assert.ok(client);
  });

  test('applies default options correctly', () => {
    // This test verifies defaults are applied (constructor doesn't throw)
    const client = new AluviaClient({
      token: 'test-token',
    });
    assert.ok(client);
  });

  test('session includes proxy adapter helpers', async () => {
    const client = new AluviaClient({
      token: 'test-token',
      logLevel: 'silent',
    });

    const url = 'http://127.0.0.1:54321';

    (client as any).configManager.init = async () => {};
    (client as any).configManager.startPolling = () => {};
    (client as any).configManager.stopPolling = () => {};
    (client as any).proxyServer.start = async () => ({
      host: '127.0.0.1',
      port: 54321,
      url,
    });
    (client as any).proxyServer.stop = async () => {};

    const session = await client.start();

    assert.strictEqual(session.url, url);
    assert.strictEqual(session.getUrl(), url);
    assert.deepStrictEqual(session.asPlaywright(), { server: url });
    assert.deepStrictEqual(session.asPuppeteer(), [`--proxy-server=${url}`]);

    const agentA = session.asNodeAgent();
    const agentB = session.asNodeAgent();
    assert.ok(agentA);
    assert.strictEqual(agentA, agentB);

    await session.close();
    assert.strictEqual((client as any).started, false);
  });
});

describe('httpClient.getConnection', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('sends If-None-Match when an ETag is provided', async () => {
    let capturedInit: any = null;

    globalThis.fetch = (async (_url: any, init: any) => {
      capturedInit = init;
      return new Response(
        JSON.stringify({
          data: {
            proxy_username: 'u',
            proxy_password: 'p',
            rules: ['*'],
            session_id: null,
            target_geo: null,
          },
        }),
        { status: 200, headers: { ETag: '"etag-1"' } }
      );
    }) as any;

    const res = await httpClient.getConnection(
      'https://api.aluvia.io/v1/',
      'test-token',
      '"etag-0"'
    );

    assert.strictEqual(capturedInit.method, 'GET');
    assert.strictEqual(capturedInit.headers['If-None-Match'], '"etag-0"');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.etag, '"etag-1"');
    assert.ok(res.body);
  });

  test('returns null body on 304 Not Modified', async () => {
    globalThis.fetch = (async () => {
      return new Response(null, { status: 304, headers: { ETag: '"etag-2"' } });
    }) as any;

    const res = await httpClient.getConnection(
      'https://api.aluvia.io/v1',
      'test-token',
      '"etag-1"'
    );

    assert.strictEqual(res.status, 304);
    assert.strictEqual(res.body, null);
    assert.strictEqual(res.etag, '"etag-2"');
  });
});

describe('matchPattern', () => {
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
  test('MissingConnectionTokenError has correct name', () => {
    const error = new MissingConnectionTokenError();
    assert.strictEqual(error.name, 'MissingConnectionTokenError');
  });

  test('InvalidConnectionTokenError has correct name', () => {
    const error = new InvalidConnectionTokenError();
    assert.strictEqual(error.name, 'InvalidConnectionTokenError');
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

