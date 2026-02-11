import { ApiError, InvalidApiKeyError } from '../errors.js';
import type { ErrorEnvelope } from './types.js';

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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function asErrorEnvelope(value: unknown): ErrorEnvelope | null {
  if (!isRecord(value)) return null;
  if (value['success'] !== false) return null;
  const error = value['error'];
  if (!isRecord(error)) return null;
  const code = error['code'];
  const message = error['message'];
  if (typeof code !== 'string' || typeof message !== 'string') return null;
  return { success: false, error: { code, message, details: error['details'] } };
}

export function formatErrorDetails(details: unknown): string {
  if (details == null) return '';
  try {
    const json = JSON.stringify(details);
    if (!json) return '';
    return json.length > 500 ? `${json.slice(0, 500)}…` : json;
  } catch {
    return String(details);
  }
}

export function throwForNon2xx(result: ApiRequestResult): never {
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
