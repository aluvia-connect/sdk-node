// Integration smoke test for Aluvia Client

import { test, mock, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { AluviaClient } from '../src/client/AluviaClient.js';
import { requestCore } from '../src/api/request.js';
import { ConfigManager } from '../src/client/ConfigManager.js';
import { AluviaApi } from '../src/api/AluviaApi.js';
import {
  MissingApiKeyError,
  InvalidApiKeyError,
  ApiError,
  ProxyStartError,
} from '../src/errors.js';
import { matchPattern, shouldProxy } from '../src/client/rules.js';
import { Logger } from '../src/client/logger.js';

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
      local_proxy: true,
    });

    const url = 'http://127.0.0.1:54321';
    let pollingStarted = false;

    (client as any).configManager.init = async () => {};
    (client as any).configManager.startPolling = () => {
      pollingStarted = true;
    };
    (client as any).configManager.stopPolling = () => {};
    (client as any).proxyServer.start = async () => ({
      host: '127.0.0.1',
      port: 54321,
      url,
    });
    (client as any).proxyServer.stop = async () => {};

    const connection = await client.start();
    assert.strictEqual(pollingStarted, true);

    assert.strictEqual(connection.url, url);
    assert.strictEqual(connection.getUrl(), url);
    assert.deepStrictEqual(connection.asPlaywright(), { server: url });
    assert.deepStrictEqual(connection.asPuppeteer(), [`--proxy-server=${url}`]);

    const agentsA = connection.asNodeAgents();
    const agentsB = connection.asNodeAgents();
    assert.ok(agentsA.http);
    assert.ok(agentsA.https);
    assert.strictEqual(agentsA, agentsB);

    const axiosCfg = connection.asAxiosConfig();
    assert.strictEqual(axiosCfg.proxy, false);
    assert.strictEqual(axiosCfg.httpAgent, agentsA.http);
    assert.strictEqual(axiosCfg.httpsAgent, agentsA.https);

    const gotOpts = connection.asGotOptions();
    assert.strictEqual(gotOpts.agent.http, agentsA.http);
    assert.strictEqual(gotOpts.agent.https, agentsA.https);

    const dispatcherA = connection.asUndiciDispatcher();
    const dispatcherB = connection.asUndiciDispatcher();
    assert.ok(dispatcherA);
    assert.strictEqual(dispatcherA, dispatcherB);

    const fetchA = connection.asUndiciFetch();
    const fetchB = connection.asUndiciFetch();
    assert.strictEqual(typeof fetchA, 'function');
    assert.strictEqual(fetchA, fetchB);

    await connection.close();
    assert.strictEqual((client as any).started, false);
  });

  test('connection adapters use REMOTE proxy when local_proxy is false', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
      local_proxy: false,
    });

    (client as any).configManager.init = async () => {};
    (client as any).configManager.startPolling = () => {
      throw new Error('configManager.startPolling should not be called in gateway mode');
    };
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

    const agents = connection.asNodeAgents();
    assert.ok(agents.http);
    assert.ok(agents.https);

    const axiosCfg = connection.asAxiosConfig();
    assert.strictEqual(axiosCfg.proxy, false);
    assert.strictEqual(axiosCfg.httpAgent, agents.http);
    assert.strictEqual(axiosCfg.httpsAgent, agents.https);

    const gotOpts = connection.asGotOptions();
    assert.strictEqual(gotOpts.agent.http, agents.http);
    assert.strictEqual(gotOpts.agent.https, agents.https);

    const dispatcher = connection.asUndiciDispatcher();
    assert.ok(dispatcher);

    const fetchFn = connection.asUndiciFetch();
    assert.strictEqual(typeof fetchFn, 'function');

    await connection.close();
    assert.strictEqual((client as any).started, false);
  });

  test('gateway mode start throws when account connection config is missing', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
      local_proxy: false,
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

  test('connection adapters use LOCAL proxy by default (local_proxy default true)', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
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

    const connection = await client.start();

    assert.strictEqual(connection.url, url);
    assert.deepStrictEqual(connection.asPlaywright(), { server: url });

    await connection.close();
  });

  test('start() is concurrency-safe: concurrent calls share one in-flight startup', async () => {
    const client = new AluviaClient({
      apiKey: 'test-api-key',
      logLevel: 'silent',
      local_proxy: true,
    });

    const url = 'http://127.0.0.1:54321';

    let initCalls = 0;
    let pollingStarts = 0;
    let proxyStarts = 0;

    let resolveInit: (() => void) | null = null;
    const initGate = new Promise<void>((res) => {
      resolveInit = res;
    });

    (client as any).configManager.init = async () => {
      initCalls += 1;
      await initGate;
    };
    (client as any).configManager.startPolling = () => {
      pollingStarts += 1;
    };
    (client as any).configManager.stopPolling = () => {};
    (client as any).proxyServer.start = async () => {
      proxyStarts += 1;
      return { host: '127.0.0.1', port: 54321, url };
    };
    (client as any).proxyServer.stop = async () => {};

    const p1 = client.start();
    const p2 = client.start();

    // Unblock init so startup can proceed.
    // @ts-ignore
    resolveInit?.();

    const [c1, c2] = await Promise.all([p1, p2]);

    assert.strictEqual(initCalls, 1);
    assert.strictEqual(pollingStarts, 1);
    assert.strictEqual(proxyStarts, 1);
    assert.strictEqual(c1, c2);

    await c1.close();
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

  test('init() throws in strict mode when create connection fails (prevents silent direct routing)', async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'server_error', message: 'boom' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }) as any;

    const mgr = new ConfigManager({
      apiKey: 'test-api-key',
      apiBaseUrl: 'https://api.aluvia.io/v1',
      pollIntervalMs: 5000,
      gatewayProtocol: 'http',
      gatewayPort: 8080,
      logLevel: 'silent',
      strict: true,
    });

    await assert.rejects(
      () => mgr.init(),
      (err: any) => err instanceof ApiError && err.statusCode === 500,
    );
  });

  test('setConfig() throws on non-2xx (no silent failure)', async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'server_error', message: 'nope' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
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
      strict: true,
    });

    (mgr as any).accountConnectionId = '123';

    await assert.rejects(
      () => mgr.setConfig({ rules: ['*'] }),
      (err: any) => err instanceof ApiError && err.statusCode === 500,
    );
  });

  test('setConfig() throws InvalidApiKeyError on 403', async () => {
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'forbidden', message: 'Forbidden' } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
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
      strict: true,
    });

    (mgr as any).accountConnectionId = '123';

    await assert.rejects(() => mgr.setConfig({ rules: ['*'] }), InvalidApiKeyError);
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

