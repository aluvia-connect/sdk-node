// Aluvia Client Node
// Main entry point

// Public class
export { AluviaClient } from './AluviaClient.js';
export { AluviaApi } from './api/AluviaApi.js';

// Public error classes
export {
  MissingApiKeyError,
  InvalidApiKeyError,
  ApiError,
  ProxyStartError,
} from './errors.js';

// Public types
export type {
  GatewayProtocol,
  LogLevel,
  AluviaClientOptions,
  AluviaClientConnection,
  PlaywrightProxySettings,
} from './types.js';

export type {
  Account,
  AccountUsage,
  AccountPayment,
  AccountConnection,
  AccountConnectionDeleteResult,
  Geo,
  SuccessEnvelope,
  ErrorEnvelope,
  Envelope,
} from './api/types.js';
