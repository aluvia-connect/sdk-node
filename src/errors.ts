// Error classes for Aluvia Client

/**
 * Thrown when the apiKey is not provided to AluviaClient.
 */
export class MissingApiKeyError extends Error {
  constructor(message = 'Aluvia connection apiKey is required') {
    super(message);
    this.name = 'MissingApiKeyError';
    Object.setPrototypeOf(this, MissingApiKeyError.prototype);
  }
}

/**
 * Thrown when the API returns 401 or 403, indicating the apiKey is invalid.
 */
export class InvalidApiKeyError extends Error {
  constructor(message = 'Invalid or expired Aluvia connection apiKey') {
    super(message);
    this.name = 'InvalidApiKeyError';
    Object.setPrototypeOf(this, InvalidApiKeyError.prototype);
  }
}

/**
 * Thrown for general API errors (non-2xx responses other than auth errors).
 */
export class ApiError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Thrown when the local proxy server fails to start.
 */
export class ProxyStartError extends Error {
  constructor(message = 'Failed to start local proxy server') {
    super(message);
    this.name = 'ProxyStartError';
    Object.setPrototypeOf(this, ProxyStartError.prototype);
  }
}

