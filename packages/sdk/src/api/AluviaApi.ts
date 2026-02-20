import { requestCore } from './request.js';
import { createAccountApi } from './account.js';
import { createGeosApi } from './geos.js';
import { MissingApiKeyError } from '../errors.js';
import type { AluviaApiRequestArgs } from './apiUtils.js';

export type { AluviaApiRequestArgs };

export type AluviaApiOptions = {
  apiKey: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export class AluviaApi {
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs?: number;
  private readonly fetchImpl?: typeof fetch;

  public readonly account: ReturnType<typeof createAccountApi>;
  public readonly geos: ReturnType<typeof createGeosApi>;

  constructor(options: AluviaApiOptions) {
    const apiKey = String(options.apiKey ?? '').trim();
    if (!apiKey) {
      throw new MissingApiKeyError('Aluvia apiKey is required');
    }

    this.apiKey = apiKey;
    this.apiBaseUrl = options.apiBaseUrl ?? 'https://api.aluvia.io/v1';
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetch;

    const ctx = {
      request: async (args: {
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
        path: string;
        query?: Record<string, string | number | boolean | null | undefined>;
        body?: unknown;
        headers?: Record<string, string>;
        etag?: string | null;
      }) => {
        return await requestCore({
          apiBaseUrl: this.apiBaseUrl,
          apiKey: this.apiKey,
          method: args.method,
          path: args.path,
          query: args.query,
          body: args.body,
          headers: args.headers,
          ifNoneMatch: args.etag,
          timeoutMs: this.timeoutMs,
          fetch: this.fetchImpl,
        });
      },
    };

    this.account = createAccountApi(ctx);
    this.geos = createGeosApi(ctx);
  }

  async request(args: AluviaApiRequestArgs): Promise<{ status: number; etag: string | null; body: unknown | null }> {
    return await requestCore({
      apiBaseUrl: this.apiBaseUrl,
      apiKey: this.apiKey,
      method: args.method,
      path: args.path,
      query: args.query,
      body: args.body,
      headers: args.headers,
      timeoutMs: this.timeoutMs,
      fetch: this.fetchImpl,
    });
  }
}


