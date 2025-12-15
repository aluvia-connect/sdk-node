// Error classes for Aluvia Client

/**
 * Thrown when the connection token is not provided to AluviaClient.
 */
export class MissingConnectionTokenError extends Error {
  constructor(message = 'Aluvia connection token is required') {
    super(message);
    this.name = 'MissingConnectionTokenError';
    Object.setPrototypeOf(this, MissingConnectionTokenError.prototype);
  }
}

/**
 * Thrown when the API returns 401 or 403, indicating the token is invalid.
 */
export class InvalidConnectionTokenError extends Error {
  constructor(message = 'Invalid or expired Aluvia connection token') {
    super(message);
    this.name = 'InvalidConnectionTokenError';
    Object.setPrototypeOf(this, InvalidConnectionTokenError.prototype);
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

