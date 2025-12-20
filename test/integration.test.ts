// Integration smoke test for Aluvia Client

import { test, mock, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { AluviaClient } from '../src/AluviaClient.js';
import { requestCore } from '../src/api/request.js';
import { ConfigManager } from '../src/ConfigManager.js';
import { AluviaApi } from '../src/api/AluviaApi.js';
import {
  MissingApiKeyError,
  InvalidApiKeyError,
  ApiError,
  ProxyStartError,
} from '../src/errors.js';
import { matchPattern, shouldProxy } from '../src/rules.js';
import { Logger } from '../src/logger.js';

describe('AluviaClient', () => {
  afterEach(() => {
    mock.reset();
  });

  test('throws MissingApiKeyError when apiKey is not provided', () => {
    assert.throws(
      () => new AluviaClient({ apiKey: '' }),
      MissingApiKeyError
    );
  });

  test('can be instantiated with valid apiKey', () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
    });
    assert.ok(client);
  });

  test('applies default options correctly', () => {
    // This test verifies defaults are applied (constructor doesn't throw)
    const client = new AluviaClient({
      apiKey: 'test-api-key',
    });
    assert.ok(client);
  });

  test('connection includes proxy adapter helpers', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
      smart_routing: true,
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

    const connection = await client.start();

    assert.strictEqual(connection.url, url);
    assert.strictEqual(connection.getUrl(), url);
    assert.deepStrictEqual(connection.asPlaywright(), { server: url });
    assert.deepStrictEqual(connection.asPuppeteer(), [`--proxy-server=${url}`]);

    const agentA = connection.asNodeAgent();
    const agentB = connection.asNodeAgent();
    assert.ok(agentA);
    assert.strictEqual(agentA, agentB);

    await connection.close();
    assert.strictEqual((client as any).started, false);
  });

  test('connection adapters use REMOTE proxy when smart_routing is false (default)', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
      // smart_routing omitted => false
    });

    (client as any).configManager.init = async () => {};
    (client as any).configManager.startPolling = () => {};
    (client as any).configManager.stopPolling = () => {};
    // Ensure local proxy never starts
    (client as any).proxyServer.start = async () => {
      throw new Error('proxyServer.start should not be called');
    };

    // Provide remote config via getConfig()
    (client as any).configManager.getConfig = () => ({
      rawProxy: {
        protocol: 'http',
        host: 'gateway.aluvia.io',
        port: 8080,
        username: 'user',
        password: 'pass',
      },
      rules: ['*'],
      sessionId: null,
      targetGeo: null,
      etag: '"e"',
    });

    const connection = await client.start();

    assert.strictEqual(connection.url, 'http://gateway.aluvia.io:8080');
    assert.deepStrictEqual(connection.asPlaywright(), {
      server: 'http://gateway.aluvia.io:8080',
      username: 'user',
      password: 'pass',
    });
    assert.deepStrictEqual(connection.asPuppeteer(), ['--proxy-server=http://gateway.aluvia.io:8080']);
    assert.strictEqual(typeof connection.getUrl(), 'string');
    assert.ok(connection.getUrl().includes('gateway.aluvia.io:8080'));

    await connection.close();
    assert.strictEqual((client as any).started, false);
  });

  test('gateway mode start throws when account connection config is missing', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
    });

    (client as any).configManager.init = async () => {};
    (client as any).configManager.getConfig = () => null;
    (client as any).configManager.startPolling = () => {};
    (client as any).configManager.stopPolling = () => {};
    (client as any).proxyServer.start = async () => {
      throw new Error('proxyServer.start should not be called');
    };

    await assert.rejects(() => client.start(), ApiError);
  });

  test('connection adapters use LOCAL proxy when smart_routing is true', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
      smart_routing: true,
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

    const connection = await client.start();

    assert.strictEqual(connection.url, url);
    assert.deepStrictEqual(connection.asPlaywright(), { server: url });

    await connection.close();
  });
});

describe('requestCore', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('requestCore sends If-None-Match when provided', async () => {
    let capturedInit: any = null;
    let capturedUrl: any = null;

    globalThis.fetch = (async (url: any, init: any) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({ data: { id: 123 } }), {
        status: 200,
        headers: { ETag: '"etag-a"' },
      });
    }) as any;

    const res = await requestCore({
      apiBaseUrl: 'https://api.aluvia.io/v1/',
      apiKey: 'test-api-key',
      method: 'GET',
      path: '/account/connections/123',
      ifNoneMatch: '"etag-prev"',
    });

    assert.ok(String(capturedUrl).endsWith('/account/connections/123'));
    assert.strictEqual(capturedInit.method, 'GET');
    assert.strictEqual(capturedInit.headers['If-None-Match'], '"etag-prev"');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.etag, '"etag-a"');
  });

  test('requestCore POSTs JSON body with Content-Type when body is provided', async () => {
    let capturedInit: any = null;

    globalThis.fetch = (async (_url: any, init: any) => {
      capturedInit = init;
      return new Response(JSON.stringify({ data: { id: 999 } }), {
        status: 201,
        headers: { ETag: '"etag-c"', 'Content-Type': 'application/json' },
      });
    }) as any;

    const res = await requestCore({
      apiBaseUrl: 'https://api.aluvia.io/v1',
      apiKey: 'test-api-key',
      method: 'POST',
      path: '/account/connections',
      body: {},
    });

    assert.strictEqual(capturedInit.method, 'POST');
    assert.strictEqual(capturedInit.headers['Content-Type'], 'application/json');
    assert.strictEqual(res.status, 201);
    assert.ok(res.body);
  });

  test('requestCore times out and rejects', async () => {
    globalThis.fetch = ((_: any, init: any) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      });
    }) as any;

    await assert.rejects(async () => {
      await requestCore({
        apiBaseUrl: 'https://api.aluvia.io/v1',
        apiKey: 'test-api-key',
        method: 'GET',
        path: '/account',
        timeoutMs: 10,
      });
    }, (err: any) => {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.statusCode, 408);
      assert.ok(String(err.message).includes('Request timed out after 10ms'));
      return true;
    });
  });
});

describe('ConfigManager polling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('pollOnce sends If-None-Match and treats 304 as no update', async () => {
    let capturedInit: any = null;

    globalThis.fetch = (async (_url: any, init: any) => {
      capturedInit = init;
      return new Response('', { status: 304, headers: { ETag: '"etag-next"' } });
    }) as any;

    const mgr = new ConfigManager({
      apiKey: 'test-api-key',
      apiBaseUrl: 'https://api.aluvia.io/v1',
      pollIntervalMs: 5000,
      gatewayProtocol: 'http',
      gatewayPort: 8080,
      logLevel: 'silent',
      connectionId: '123',
    });

    const existingConfig = {
      rawProxy: {
        protocol: 'http',
        host: 'gateway.aluvia.io' as const,
        port: 8080,
        username: 'u',
        password: 'p',
      },
      rules: ['*'],
      sessionId: null,
      targetGeo: null,
      etag: '"etag-prev"',
    };

    (mgr as any).config = existingConfig;
    (mgr as any).accountConnectionId = '123';

    await (mgr as any).pollOnce();

    assert.strictEqual(capturedInit.headers['If-None-Match'], '"etag-prev"');
    assert.strictEqual(mgr.getConfig(), existingConfig);
  });

  test('pollOnce supports 200 → 304 → 200 sequence', async () => {
    let callCount = 0;
    const seenIfNoneMatch: Array<string | undefined> = [];

    globalThis.fetch = (async (_url: any, init: any) => {
      callCount += 1;
      seenIfNoneMatch.push(init?.headers?.['If-None-Match']);

      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              proxy_username: 'u1',
              proxy_password: 'p1',
              rules: ['*'],
              session_id: null,
              target_geo: null,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"e1"' } },
        );
      }

      if (callCount === 2) {
        return {
          status: 304,
          headers: new Headers({ ETag: '"e1"' }),
          text: async () => '',
        } as any;
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            proxy_username: 'u2',
            proxy_password: 'p2',
            rules: ['example.com'],
            session_id: 's2',
            target_geo: 'US',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"e2"' } },
      );
    }) as any;

    const mgr = new ConfigManager({
      apiKey: 'test-api-key',
      apiBaseUrl: 'https://api.aluvia.io/v1',
      pollIntervalMs: 5000,
      gatewayProtocol: 'http',
      gatewayPort: 8080,
      logLevel: 'silent',
      connectionId: '123',
    });

    await mgr.init();
    const cfg1 = mgr.getConfig();
    assert.ok(cfg1);
    assert.strictEqual(cfg1?.etag, '"e1"');
    assert.strictEqual(cfg1?.rawProxy.username, 'u1');

    await (mgr as any).pollOnce();
    const cfgAfter304 = mgr.getConfig();
    assert.strictEqual(cfgAfter304?.etag, '"e1"');
    assert.strictEqual(cfgAfter304?.rawProxy.username, 'u1');

    await (mgr as any).pollOnce();
    const cfg2 = mgr.getConfig();
    assert.ok(cfg2);
    assert.strictEqual(cfg2?.etag, '"e2"');
    assert.strictEqual(cfg2?.rawProxy.username, 'u2');
    assert.strictEqual(cfg2?.sessionId, 's2');

    assert.deepStrictEqual(seenIfNoneMatch, [undefined, '"e1"', '"e1"']);
  });
});

describe('AluviaApi endpoint helpers', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('account.get uses GET /account and unwraps success envelope', async () => {
    let capturedUrl: any = null;
    let capturedInit: any = null;

    globalThis.fetch = (async (url: any, init: any) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({ success: true, data: { id: 'acct-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1/' });
    const data = await api.account.get();

    assert.ok(String(capturedUrl).endsWith('/account'));
    assert.strictEqual(capturedInit.method, 'GET');
    assert.strictEqual(capturedInit.headers.Authorization, 'Bearer test-api-key');
    assert.ok((data as any).id);
  });

  test('account.usage.get sends optional query params', async () => {
    let capturedUrl: any = null;

    globalThis.fetch = (async (url: any) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1' });
    await api.account.usage.get({ start: '2025-01-01', end: '2025-01-31' });

    assert.ok(String(capturedUrl).includes('/account/usage?'));
    assert.ok(String(capturedUrl).includes('start=2025-01-01'));
    assert.ok(String(capturedUrl).includes('end=2025-01-31'));
  });

  test('account.payments.list uses GET /account/payments', async () => {
    let capturedUrl: any = null;
    globalThis.fetch = (async (url: any) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [{ id: 'p1' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1' });
    const res = await api.account.payments.list();
    assert.ok(String(capturedUrl).endsWith('/account/payments'));
    assert.ok(Array.isArray(res));
  });

  test('account.connections.list uses GET /account/connections', async () => {
    let capturedUrl: any = null;
    globalThis.fetch = (async (url: any) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [{ id: 123 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1' });
    const res = await api.account.connections.list();
    assert.ok(String(capturedUrl).endsWith('/account/connections'));
    assert.ok(Array.isArray(res));
  });

  test('account.connections.create uses POST /account/connections with JSON body', async () => {
    let capturedInit: any = null;
    globalThis.fetch = (async (_url: any, init: any) => {
      capturedInit = init;
      return new Response(JSON.stringify({ success: true, data: { id: 999 } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1' });
    const res = await api.account.connections.create({ target_geo: 'US' });

    assert.strictEqual(capturedInit.method, 'POST');
    assert.strictEqual(capturedInit.headers['Content-Type'], 'application/json');
    assert.strictEqual(JSON.parse(capturedInit.body).target_geo, 'US');
    assert.ok((res as any).id);
  });

  test('account.connections.get sends If-None-Match and returns null on 304', async () => {
    let capturedInit: any = null;
    globalThis.fetch = (async (_url: any, init: any) => {
      capturedInit = init;
      return {
        status: 304,
        headers: new Headers({ ETag: '"e2"' }),
        text: async () => '',
      } as any;
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1' });
    const res = await api.account.connections.get(123, { etag: '"e1"' });

    assert.strictEqual(capturedInit.headers['If-None-Match'], '"e1"');
    assert.strictEqual(res, null);
  });

  test('account.connections.patch uses PATCH /account/connections/:id with JSON body', async () => {
    let capturedUrl: any = null;
    let capturedInit: any = null;

    globalThis.fetch = (async (url: any, init: any) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({ success: true, data: { id: 123, rules: ['*'] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1' });
    const res = await api.account.connections.patch(123, { rules: ['*'] });

    assert.ok(String(capturedUrl).endsWith('/account/connections/123'));
    assert.strictEqual(capturedInit.method, 'PATCH');
    assert.strictEqual(JSON.parse(capturedInit.body).rules[0], '*');
    assert.ok((res as any).id);
  });

  test('account.connections.delete uses DELETE /account/connections/:id and unwraps result', async () => {
    let capturedUrl: any = null;
    let capturedInit: any = null;

    globalThis.fetch = (async (url: any, init: any) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({ success: true, data: { connection_id: '123', deleted: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1' });
    const res = await api.account.connections.delete(123);

    assert.ok(String(capturedUrl).endsWith('/account/connections/123'));
    assert.strictEqual(capturedInit.method, 'DELETE');
    assert.deepStrictEqual(res, { connection_id: '123', deleted: true });
  });

  test('geos.list uses GET /geos', async () => {
    let capturedUrl: any = null;
    globalThis.fetch = (async (url: any) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [{ code: 'US' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1/' });
    const res = await api.geos.list();
    assert.ok(String(capturedUrl).endsWith('/geos'));
    assert.ok(Array.isArray(res));
  });

  test('throws InvalidApiKeyError on 401 for helpers', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ success: false, error: { code: 'unauthorized', message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const api = new AluviaApi({ apiKey: 'bad', apiBaseUrl: 'https://api.aluvia.io/v1' });
    await assert.rejects(() => api.account.get(), InvalidApiKeyError);
  });

  test('throws ApiError with details on 422-style error envelope', async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'validation_error', message: 'Validation failed', details: { field: 'x' } },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      );
    }) as any;

    const api = new AluviaApi({ apiKey: 'test-api-key', apiBaseUrl: 'https://api.aluvia.io/v1' });
    await assert.rejects(() => api.account.connections.create({}), ApiError);
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
  test('MissingApiKeyError has correct name', () => {
    const error = new MissingApiKeyError();
    assert.strictEqual(error.name, 'MissingApiKeyError');
  });

  test('InvalidApiKeyError has correct name', () => {
    const error = new InvalidApiKeyError();
    assert.strictEqual(error.name, 'InvalidApiKeyError');
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

