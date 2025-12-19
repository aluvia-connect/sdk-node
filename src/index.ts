// Aluvia Client Node
// Main entry point

// Public class
export { AluviaClient } from './AluviaClient.js';

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
  AluviaClientSession,
  PlaywrightProxySettings,
} from './types.js';
