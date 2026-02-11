import { ApiError } from '../errors.js';
import type { Geo } from './types.js';
import { isRecord, throwForNon2xx } from './apiUtils.js';
import type { ApiContext } from './apiUtils.js';

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
