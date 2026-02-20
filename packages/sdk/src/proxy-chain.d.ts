declare module "proxy-chain" {
  export type PrepareRequestFunctionParams = {
    request: {
      url?: string;
      headers?: Record<string, string | string[] | undefined>;
    };
    hostname?: string;
    port?: number;
    isHttp?: boolean;
  };

  export type PrepareRequestFunctionResult =
    | { upstreamProxyUrl: string }
    | undefined;

  export type PrepareRequestFunction =
    | ((params: PrepareRequestFunctionParams) => PrepareRequestFunctionResult)
    | ((
        params: PrepareRequestFunctionParams,
      ) => Promise<PrepareRequestFunctionResult>);

  export type ServerOptions = {
    host?: string;
    port?: number;
    prepareRequestFunction?: PrepareRequestFunction;
  };

  export class Server {
    constructor(options: ServerOptions);
    listen(): Promise<void>;
    close(force?: boolean): Promise<void>;
    server: {
      address(): import("net").AddressInfo | string | null;
    };
  }
}
