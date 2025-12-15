// HTTP client wrapper for Aluvia API

/**
 * Response shape from GET /connection endpoint.
 */
export type ConnectionApiResponse = {
  data: {
    proxy_username: string;
    proxy_password: string;
    rules: string[];
    session_id: string | null;
    target_geo: string | null;
  }
};

/**
 * Result from getConnection() call.
 */
export type GetConnectionResult = {
  status: number;
  body: ConnectionApiResponse | null;
  /**
   * ETag returned by the API (if present).
   * Used for conditional requests via If-None-Match.
   */
  etag: string | null;
};

/**
 * Fetch connection configuration from the Aluvia API.
 *
 * @param apiBaseUrl - Base URL for the Aluvia API (e.g., 'https://api.aluvia.io/v1')
 * @param token - Connection API token (Bearer token)
 * @param etag - Optional ETag for conditional request (If-None-Match)
 * @returns GetConnectionResult with status, etag, and body (null on 304)
 */
export async function getConnection(
  apiBaseUrl: string,
  token: string,
  etag?: string | null,
): Promise<GetConnectionResult> {
  // Build URL, ensuring no trailing slash duplication
  const url = `${apiBaseUrl.replace(/\/$/, '')}/connection`;

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
    const body = (await response.json()) as ConnectionApiResponse;
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
 * Fetch connection configuration from the Aluvia API.
 *
 * @param apiBaseUrl - Base URL for the Aluvia API (e.g., 'https://api.aluvia.io/v1')
 * @param token - Connection API token (Bearer token)
 * @param body - Parameters to update
 * @param etag - Optional ETag for conditional request (If-None-Match)
 * @returns GetConnectionResult with status, etag, and body (null on 304)
 */
export async function setConnection(
  apiBaseUrl: string,
  token: string,
  body: Object,
): Promise<GetConnectionResult> {
  // Build URL, ensuring no trailing slash duplication
  const url = `${apiBaseUrl.replace(/\/$/, '')}/connection`;

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
    const body = (await response.json()) as ConnectionApiResponse;
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
