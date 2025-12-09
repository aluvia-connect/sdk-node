/**
 * Thrown when the user token is not provided to AluviaClient.
 */
export declare class MissingUserTokenError extends Error {
    constructor(message?: string);
}
/**
 * Thrown when the API returns 401 or 403, indicating the token is invalid.
 */
export declare class InvalidUserTokenError extends Error {
    constructor(message?: string);
}
/**
 * Thrown for general API errors (non-2xx responses other than auth errors).
 */
export declare class ApiError extends Error {
    readonly statusCode?: number;
    constructor(message: string, statusCode?: number);
}
/**
 * Thrown when the local proxy server fails to start.
 */
export declare class ProxyStartError extends Error {
    constructor(message?: string);
}
