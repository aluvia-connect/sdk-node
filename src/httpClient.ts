// HTTP client wrapper for Aluvia API

/**
 * Response shape from /account/connections endpoints.
 */
export type AccountConnectionApiResponse = {
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
  body: AccountConnectionApiResponse | null;
  /**
   * ETag returned by the API (if present).
   * Used for conditional requests via If-None-Match.
   */
  etag: string | null;
};

export async function getAccountConnection(
  apiBaseUrl: string,
  token: string,
  connectionId: number,
  etag?: string | null,
): Promise<GetConnectionResult> {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/account/connections/${connectionId}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  if (etag) headers['If-None-Match'] = etag;

  const response = await fetch(url, { method: 'GET', headers });
  const responseEtag = response.headers.get('etag');

  if (response.status === 304) {
    return { status: 304, etag: responseEtag, body: null };
  }

  if (response.status === 200) {
    const body = (await response.json()) as AccountConnectionApiResponse;
    return { status: 200, etag: responseEtag, body };
  }

  return { status: response.status, etag: responseEtag, body: null };
}

export async function createAccountConnection(
  apiBaseUrl: string,
  token: string,
  body: Object,
): Promise<GetConnectionResult> {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/account/connections`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });

  const responseEtag = response.headers.get('etag');

  if (response.status === 304) {
    return { status: 304, etag: responseEtag, body: null };
  }

  if (response.status === 200 || response.status === 201) {
    const resBody = (await response.json()) as AccountConnectionApiResponse;
    return { status: response.status, etag: responseEtag, body: resBody };
  }

  return { status: response.status, etag: responseEtag, body: null };
}

export async function patchAccountConnection(
  apiBaseUrl: string,
  token: string,
  connectionId: number,
  body: Object,
): Promise<GetConnectionResult> {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/account/connections/${connectionId}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body ?? {}),
  });

  const responseEtag = response.headers.get('etag');

  if (response.status === 304) {
    return { status: 304, etag: responseEtag, body: null };
  }

  if (response.status === 200) {
    const resBody = (await response.json()) as AccountConnectionApiResponse;
    return { status: 200, etag: responseEtag, body: resBody };
  }

  return { status: response.status, etag: responseEtag, body: null };
}
