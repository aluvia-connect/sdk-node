// Error classes for Aluvia Client

/**
 * Thrown when the user token is not provided to AluviaClient.
 */
export class MissingUserTokenError extends Error {
  constructor(message = 'Aluvia user token is required') {
    super(message);
    this.name = 'MissingUserTokenError';
    Object.setPrototypeOf(this, MissingUserTokenError.prototype);
  }
}

/**
 * Thrown when the API returns 401 or 403, indicating the token is invalid.
 */
export class InvalidUserTokenError extends Error {
  constructor(message = 'Invalid or expired Aluvia user token') {
    super(message);
    this.name = 'InvalidUserTokenError';
    Object.setPrototypeOf(this, InvalidUserTokenError.prototype);
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

