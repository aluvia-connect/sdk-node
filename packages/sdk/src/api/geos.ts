import type { Geo } from "./types.js";
import { requestAndUnwrap } from "./apiUtils.js";
import type { ApiContext } from "./apiUtils.js";

export function createGeosApi(ctx: ApiContext) {
  return {
    list: async (): Promise<Array<Geo>> => {
      const { data } = await requestAndUnwrap<Array<Geo>>(ctx, {
        method: "GET",
        path: "/geos",
      });
      return data;
    },
  };
}
