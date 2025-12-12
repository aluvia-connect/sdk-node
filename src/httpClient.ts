// HTTP client wrapper for Aluvia API

/**
 * Response shape from GET /user endpoint.
 */
export type UserApiResponse = {
  data: {
    proxy_username: string;
    proxy_password: string;
    rules: string[];
    session_id: string | null;
    target_geo: string | null;
  }
};

/**
 * Result from getUser() call.
 */
export type GetUserResult = {
  status: number;
  /**
   * ETag returned by the API (if present).
   * Used for conditional requests via If-None-Match.
   */
  etag: string | null;
  body: UserApiResponse | null;
};

/**
 * Fetch user configuration from the Aluvia API.
 *
 * @param apiBaseUrl - Base URL for the Aluvia API (e.g., 'https://api.aluvia.io/v1')
 * @param token - User API token (Bearer token)
 * @param etag - Optional ETag for conditional request (If-None-Match)
 * @returns GetUserResult with status, etag, and body (null on 304)
 */
export async function getUser(
  apiBaseUrl: string,
  token: string,
  etag?: string | null,
): Promise<GetUserResult> {
  // Build URL, ensuring no trailing slash duplication
  const url = `${apiBaseUrl.replace(/\/$/, '')}/user`;

  // Build headers
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  if (etag) {
    headers['If-None-Match'] = etag;
  }

  // Make the request
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const responseEtag = response.headers.get('etag');

  // Handle 304 Not Modified
  if (response.status === 304) {
    return {
      status: 304,
      etag: responseEtag,
      body: null,
    };
  }

  // For 200 OK, parse the JSON body
  if (response.status === 200) {
    const body = (await response.json()) as UserApiResponse;
    return {
      status: 200,
      etag: responseEtag,
      body,
    };
  }

  // For other statuses (401, 403, 4xx, 5xx), return status without body
  return {
    status: response.status,
    etag: responseEtag,
    body: null,
  };
}

/**
 * Fetch user configuration from the Aluvia API.
 *
 * @param apiBaseUrl - Base URL for the Aluvia API (e.g., 'https://api.aluvia.io/v1')
 * @param token - User API token (Bearer token)
 * @param body - Parameters to update
 * @param etag - Optional ETag for conditional request (If-None-Match)
 * @returns GetUserResult with status, etag, and body (null on 304)
 */
export async function setUser(
  apiBaseUrl: string,
  token: string,
  body: Object,
): Promise<GetUserResult> {
  // Build URL, ensuring no trailing slash duplication
  const url = `${apiBaseUrl.replace(/\/$/, '')}/user`;

  // Build headers
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // Make the request
  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  const responseEtag = response.headers.get('etag');

  // Handle 304 Not Modified
  if (response.status === 304) {
    return {
      status: 304,
      etag: responseEtag,
      body: null,
    };
  }

  // For 200 OK, parse the JSON body
  if (response.status === 200) {
    const body = (await response.json()) as UserApiResponse;
    return {
      status: 200,
      etag: responseEtag,
      body,
    };
  }

  // For other statuses (401, 403, 4xx, 5xx), return status without body
  return {
    status: response.status,
    etag: responseEtag,
    body: null,
  };
}
