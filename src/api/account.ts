import { ApiError, InvalidApiKeyError } from '../errors.js';
import type {
  Account,
  AccountConnection,
  AccountConnectionDeleteResult,
  AccountPayment,
  AccountUsage,
  Envelope,
  ErrorEnvelope,
  SuccessEnvelope,
} from './types.js';

export type ApiRequestArgs = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  etag?: string | null;
};

export type ApiRequestResult = {
  status: number;
  etag: string | null;
  body: unknown | null;
};

export type ApiContext = {
  request: (args: ApiRequestArgs) => Promise<ApiRequestResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asErrorEnvelope(value: unknown): ErrorEnvelope | null {
  if (!isRecord(value)) return null;
  if (value['success'] !== false) return null;
  const error = value['error'];
  if (!isRecord(error)) return null;
  const code = error['code'];
  const message = error['message'];
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return { success: false, error: { code, message, details: error['details'] } };
}

function unwrapSuccess<T>(value: unknown): T | null {
  if (!isRecord(value)) return null;

  if (value['success'] === true && 'data' in value) {
    return (value as SuccessEnvelope<T>).data;
  }

  if ('data' in value) {
    return (value as { data: T }).data;
  }

  return null;
}

function formatErrorDetails(details: unknown): string {
  if (details == null) return '';
  try {
    const json = JSON.stringify(details);
    if (!json) return '';
    return json.length > 500 ? `${json.slice(0, 500)}…` : json;
  } catch {
    return String(details);
  }
}

function throwForNon2xx(result: ApiRequestResult): never {
  const status = result.status;

  if (status === 401 || status === 403) {
    throw new InvalidApiKeyError(
      `Authentication failed (HTTP ${status}). Check token validity and that you are using an account API token for account endpoints.`,
    );
  }

  const maybeError = asErrorEnvelope(result.body);
  if (maybeError) {
    const details = formatErrorDetails(maybeError.error.details);
    const detailsSuffix = details ? ` details=${details}` : '';
    throw new ApiError(
      `API request failed (HTTP ${status}) code=${maybeError.error.code} message=${maybeError.error.message}${detailsSuffix}`,
      status,
    );
  }

  throw new ApiError(`API request failed (HTTP ${status})`, status);
}

async function requestAndUnwrap<T>(
  ctx: ApiContext,
  args: ApiRequestArgs,
): Promise<{ data: T; etag: string | null }> {
  const result = await ctx.request(args);

  if (result.status < 200 || result.status >= 300) {
    throwForNon2xx(result);
  }

  const data = unwrapSuccess<T>(result.body);
  if (data == null) {
    throw new ApiError('API response missing expected success envelope data', result.status);
  }

  return { data, etag: result.etag };
}

export function createAccountApi(ctx: ApiContext) {
  return {
    get: async (): Promise<Account> => {
      const { data } = await requestAndUnwrap<Account>(ctx, {
        method: 'GET',
        path: '/account',
      });
      return data;
    },
    usage: {
      get: async (params: { start?: string; end?: string } = {}): Promise<AccountUsage> => {
        const { data } = await requestAndUnwrap<AccountUsage>(ctx, {
          method: 'GET',
          path: '/account/usage',
          query: {
            start: params.start,
            end: params.end,
          },
        });
        return data;
      },
    },
    payments: {
      list: async (params: { start?: string; end?: string } = {}): Promise<Array<AccountPayment>> => {
        const { data } = await requestAndUnwrap<Array<AccountPayment>>(ctx, {
          method: 'GET',
          path: '/account/payments',
          query: {
            start: params.start,
            end: params.end,
          },
        });
        return data;
      },
    },
    connections: {
      list: async (): Promise<Array<AccountConnection>> => {
        const { data } = await requestAndUnwrap<Array<AccountConnection>>(ctx, {
          method: 'GET',
          path: '/account/connections',
        });
        return data;
      },
      create: async (body: Record<string, unknown>): Promise<AccountConnection> => {
        const { data } = await requestAndUnwrap<AccountConnection>(ctx, {
          method: 'POST',
          path: '/account/connections',
          body,
        });
        return data;
      },
      get: async (
        connectionId: string | number,
        options: { etag?: string | null } = {},
      ): Promise<AccountConnection | null> => {
        const result = await ctx.request({
          method: 'GET',
          path: `/account/connections/${String(connectionId)}`,
          etag: options.etag ?? null,
        });

        if (result.status === 304) return null;

        if (result.status < 200 || result.status >= 300) {
          throwForNon2xx(result);
        }

        const data = unwrapSuccess<AccountConnection>(result.body);
        if (data == null) {
          throw new ApiError('API response missing expected success envelope data', result.status);
        }

        return data;
      },
      patch: async (
        connectionId: string | number,
        body: Record<string, unknown>,
      ): Promise<AccountConnection> => {
        const { data } = await requestAndUnwrap<AccountConnection>(ctx, {
          method: 'PATCH',
          path: `/account/connections/${String(connectionId)}`,
          body,
        });
        return data;
      },
      delete: async (connectionId: string | number): Promise<AccountConnectionDeleteResult> => {
        const { data } = await requestAndUnwrap<AccountConnectionDeleteResult>(ctx, {
          method: 'DELETE',
          path: `/account/connections/${String(connectionId)}`,
        });
        return data;
      },
    },
  };
}


