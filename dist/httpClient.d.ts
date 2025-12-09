/**
 * Response shape from GET /user endpoint.
 */
export type UserApiResponse = {
    proxy_username: string;
    proxy_password: string;
    rules: string[];
    session_id: string | null;
    target_geo: string | null;
};
/**
 * Result from getUser() call.
 */
export type GetUserResult = {
    status: number;
    etag: string | null;
    body: UserApiResponse | null;
};
/**
 * Fetch user configuration from the Aluvia API.
 *
 * @param apiBaseUrl - Base URL for the Aluvia API (e.g., 'https://api.aluvia.io')
 * @param token - User API token (Bearer token)
 * @param etag - Optional ETag for conditional request (If-None-Match)
 * @returns GetUserResult with status, etag, and body (null on 304)
 */
export declare function getUser(apiBaseUrl: string, token: string, etag?: string): Promise<GetUserResult>;
