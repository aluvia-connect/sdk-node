import { ApiError, InvalidApiKeyError } from '../errors.js';
import type { ErrorEnvelope, Geo } from './types.js';
import type { ApiContext, ApiRequestResult } from './account.js';

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

function unwrapSuccessArray<T>(value: unknown): Array<T> | null {
  if (!isRecord(value)) return null;
  if (value['success'] === true && Array.isArray((value as any).data)) {
    return (value as any).data as Array<T>;
  }
  if (Array.isArray((value as any).data)) {
    return (value as any).data as Array<T>;
  }
  return null;
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

export function createGeosApi(ctx: ApiContext) {
  return {
    list: async (): Promise<Array<Geo>> => {
      const result = await ctx.request({
        method: 'GET',
        path: '/geos',
      });

      if (result.status < 200 || result.status >= 300) {
        throwForNon2xx(result);
      }

      const data = unwrapSuccessArray<Geo>(result.body);
      if (data == null) {
        throw new ApiError('API response missing expected success envelope data', result.status);
      }

      return data;
    },
  };
}


