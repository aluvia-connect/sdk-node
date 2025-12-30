# AluviaApi Technical Guide

A comprehensive guide to the `AluviaApi` wrapper in the Aluvia SDK—a typed JavaScript/TypeScript client for the Aluvia REST API.

## Table of Contents

- [Introduction](#introduction)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Constructor & Options](#constructor--options)
- [API Reference](#api-reference)
  - [Account](#account)
  - [Account Usage](#account-usage)
  - [Account Payments](#account-payments)
  - [Account Connections](#account-connections)
  - [Geos](#geos)
- [Request Pipeline](#request-pipeline)
- [Response Handling](#response-handling)
- [Error Handling](#error-handling)
- [Low-Level Access](#low-level-access)
- [Types](#types)
- [Examples](#examples)

---

## Introduction

`AluviaApi` is a thin, typed wrapper around the Aluvia REST API. It provides:

- **Typed endpoint helpers** for all account and geo operations
- **Automatic response envelope unwrapping** (extracts `data` from success responses)
- **Structured error handling** with specific error classes
- **ETag support** for conditional requests
- **Timeout enforcement** via `AbortController`

### When to Use AluviaApi

Use `AluviaApi` when you need to:

- Manage Aluvia connections programmatically (create, list, update, delete)
- Query account information (balance, usage, payments)
- List available geo-targeting options
- Build custom tooling on top of the Aluvia API

**Note:** `AluviaApi` is independent of the proxy functionality. You don't need to start a local proxy to use it.

### How to Access AluviaApi

There are two ways to use `AluviaApi`:

```ts
// Option 1: Standalone instantiation
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

// Option 2: Via AluviaClient (available as client.api)
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
// client.api is an AluviaApi instance
```

---

## Quick Start

```ts
import { AluviaApi, InvalidApiKeyError, ApiError } from '@aluvia/sdk';

const api = new AluviaApi({
  apiKey: process.env.ALUVIA_API_KEY!,
});

async function main() {
  try {
    // Get account info
    const account = await api.account.get();
    console.log('Balance:', account.balance_gb, 'GB');

    // List connections
    const connections = await api.account.connections.list();
    console.log('Connections:', connections.length);

    // Create a new connection
    const newConn = await api.account.connections.create({
      description: 'my-agent',
      rules: ['*'],
    });
    console.log('Created connection:', newConn.connection_id);

    // List available geos
    const geos = await api.geos.list();
    console.log('Available geos:', geos.map(g => g.code));

  } catch (error) {
    if (error instanceof InvalidApiKeyError) {
      console.error('Invalid API key. Ensure you are using an account API token.');
    } else if (error instanceof ApiError) {
      console.error('API error:', error.message, 'Status:', error.statusCode);
    } else {
      throw error;
    }
  }
}

main();
```

---

## Architecture

`AluviaApi` is built from modular layers:

```
┌───────────────────────────────────────────────────────────────┐
│                         AluviaApi                             │
│    Constructor validates apiKey, creates namespace objects    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│   │   account   │    │    geos     │    │   request   │      │
│   │  namespace  │    │  namespace  │    │  (escape    │      │
│   │             │    │             │    │   hatch)    │      │
│   └─────────────┘    └─────────────┘    └─────────────┘      │
│          │                  │                  │              │
│          ▼                  ▼                  ▼              │
│   ┌────────────────────────────────────────────────────┐     │
│   │              requestAndUnwrap / ctx.request        │     │
│   │         (envelope unwrapping, error throwing)      │     │
│   └────────────────────────────────────────────────────┘     │
│                            │                                  │
│                            ▼                                  │
│   ┌────────────────────────────────────────────────────┐     │
│   │                   requestCore                       │     │
│   │    (URL building, headers, timeout, JSON parsing)   │     │
│   └────────────────────────────────────────────────────┘     │
│                            │                                  │
│                            ▼                                  │
│                     globalThis.fetch                          │
└───────────────────────────────────────────────────────────────┘
```

### Source Files

| File | Purpose |
|------|---------|
| `src/api/AluviaApi.ts` | Main class, constructor, namespace wiring |
| `src/api/request.ts` | Low-level HTTP transport (`requestCore`) |
| `src/api/account.ts` | Account endpoint helpers (`createAccountApi`) |
| `src/api/geos.ts` | Geos endpoint helpers (`createGeosApi`) |
| `src/api/types.ts` | TypeScript types for API responses |
| `src/errors.ts` | Error classes |

---

## Constructor & Options

```ts
new AluviaApi(options: AluviaApiOptions)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Your Aluvia account API token. |
| `apiBaseUrl` | `string` | `"https://api.aluvia.io/v1"` | Base URL for the Aluvia API. |
| `timeoutMs` | `number` | `30000` | Request timeout in milliseconds. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation. |

### API Key Requirement

The `apiKey` must be an **account API token** (not a connection token). Account endpoints (`/account/...`) require account-level authentication.

If the `apiKey` is empty or whitespace-only, the constructor throws `MissingApiKeyError`.

```ts
// ❌ Throws MissingApiKeyError
new AluviaApi({ apiKey: '' });
new AluviaApi({ apiKey: '   ' });

// ✅ Valid
new AluviaApi({ apiKey: 'alv_account_token_abc123' });
```

### Custom Fetch

You can provide a custom `fetch` implementation for testing or special environments:

```ts
const api = new AluviaApi({
  apiKey: 'test-key',
  fetch: myCustomFetch,
});
```

---

## API Reference

All high-level helpers automatically:

1. **Unwrap success envelopes** — extract `data` from `{ success: true, data: T }`
2. **Throw on non-2xx** — convert HTTP errors to `ApiError` or `InvalidApiKeyError`
3. **Return typed data** — TypeScript types for all responses

### Account

#### `api.account.get()`

Retrieves account metadata including balance and connection count.

```ts
const account = await api.account.get();
```

**Endpoint:** `GET /account`

**Returns:** `Account`

```ts
{
  account_id: "1",
  created_at: 1705478400,
  aluvia_username: "user@example.com",
  balance_gb: 84.25,
  service: "agent_connect",
  connection_count: 5
}
```

---

### Account Usage

#### `api.account.usage.get(params?)`

Retrieves usage summary (data consumed in GB) for a time range.

```ts
// All-time usage
const usage = await api.account.usage.get();

// Usage for a specific period
const usage = await api.account.usage.get({
  start: '1705478400',  // Unix timestamp as string
  end: '1706083200',
});
```

**Endpoint:** `GET /account/usage`

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start` | `string` | Optional. Unix timestamp for period start. |
| `end` | `string` | Optional. Unix timestamp for period end. |

**Returns:** `AccountUsage`

```ts
{
  account_id: "1",
  start: 1705478400,
  end: 1706083200,
  data_used_gb: 15.75
}
```

---

### Account Payments

#### `api.account.payments.list(params?)`

Lists payment transactions / top-ups for the account.

```ts
// All payments
const payments = await api.account.payments.list();

// Payments in a date range
const payments = await api.account.payments.list({
  start: '1705478400',
  end: '1708737600',
});
```

**Endpoint:** `GET /account/payments`

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `start` | `string` | Optional. Unix timestamp for period start. |
| `end` | `string` | Optional. Unix timestamp for period end. |

**Returns:** `Array<AccountPayment>`

```ts
[
  {
    id: "1",
    created_at: 1705600000,
    amount_usdc: 99.0,
    service: "agent_connect",
    status: "paid"
  }
]
```

---

### Account Connections

#### `api.account.connections.list()`

Lists all proxy connections under the account.

```ts
const connections = await api.account.connections.list();
```

**Endpoint:** `GET /account/connections`

**Returns:** `Array<AccountConnection>`

```ts
[
  {
    connection_id: "1",
    created_at: 1705478400,
    description: "pricing-scraper-1"
  },
  {
    connection_id: "2",
    created_at: 1705564800,
    description: "inventory-monitor"
  }
]
```

---

#### `api.account.connections.create(body)`

Creates a new proxy connection with generated credentials.

```ts
const connection = await api.account.connections.create({
  description: 'my-new-agent',
  rules: ['*', '-example.com'],
  target_geo: 'us-ny',
});

console.log('Connection ID:', connection.connection_id);
console.log('Proxy username:', connection.proxy_username);
console.log('Proxy password:', connection.proxy_password);
console.log('API token:', connection.api_token); // Only returned on creation
```

**Endpoint:** `POST /account/connections`

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | Optional. Human-readable description. |
| `rules` | `string[]` | Optional. Routing rules array. |
| `target_geo` | `string` | Optional. Geo-targeting code (e.g., `"us-ny"`). |
| `session_id` | `string` | Optional. Session ID for sticky sessions. |

**Returns:** `AccountConnection` (full representation including credentials and `api_token`)

```ts
{
  connection_id: "3",
  created_at: 1709000000,
  description: "my-new-agent",
  proxy_username: "Nkjh78Gh",
  proxy_password: "zxy987abc",
  api_token: "alv_connection_token_abc123def456",
  rules: ["*", "-example.com"],
  session_id: null,
  target_geo: "us-ny",
  proxy_urls: { ... }
}
```

---

#### `api.account.connections.get(connectionId, options?)`

Retrieves a single connection by ID. Supports conditional requests via ETag.

```ts
// Simple fetch
const connection = await api.account.connections.get('123');

// Conditional fetch (returns null if unchanged)
const connection = await api.account.connections.get('123', {
  etag: '"abc123"',
});

if (connection === null) {
  console.log('Connection unchanged (304)');
}
```

**Endpoint:** `GET /account/connections/:id`

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `connectionId` | `string \| number` | Connection ID. |
| `options.etag` | `string` | Optional. ETag for conditional request (`If-None-Match`). |

**Returns:** `AccountConnection | null`

- Returns `AccountConnection` on `200 OK`
- Returns `null` on `304 Not Modified` (when using ETag)

**Note:** This is the **only** helper that returns `null` for a successful response (the 304 case).

---

#### `api.account.connections.patch(connectionId, body)`

Updates a connection's properties. Only provided fields are updated.

```ts
// Update rules
await api.account.connections.patch('123', {
  rules: ['example.com', '*.google.com'],
});

// Update session ID
await api.account.connections.patch('123', {
  session_id: 'session-abc',
});

// Update geo targeting
await api.account.connections.patch('123', {
  target_geo: 'us-ca',
});

// Clear geo targeting
await api.account.connections.patch('123', {
  target_geo: null,
});
```

**Endpoint:** `PATCH /account/connections/:id`

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | Optional. Update description. |
| `rules` | `string[]` | Optional. Update routing rules. |
| `target_geo` | `string \| null` | Optional. Update or clear geo targeting. |
| `session_id` | `string \| null` | Optional. Update or clear session ID. |

**Returns:** `AccountConnection` (updated connection)

---

#### `api.account.connections.delete(connectionId)`

Permanently deletes a connection and all associated API tokens.

```ts
const result = await api.account.connections.delete('123');
console.log('Deleted:', result.deleted); // true
```

**Endpoint:** `DELETE /account/connections/:id`

**Returns:** `AccountConnectionDeleteResult`

```ts
{
  connection_id: "123",
  deleted: true
}
```

---

### Geos

#### `api.geos.list()`

Lists available geographic targeting options.

```ts
const geos = await api.geos.list();

for (const geo of geos) {
  console.log(`${geo.code}: ${geo.label}`);
}
```

**Endpoint:** `GET /geos`

**Returns:** `Array<Geo>`

```ts
[
  { code: "us", label: "United States (any)" },
  { code: "us-ny", label: "United States - New York" },
  { code: "us-ca", label: "United States - California" },
  { code: "gb", label: "United Kingdom" },
  { code: "de", label: "Germany" },
  // ...
]
```

**Note:** This endpoint is accessible by both account tokens and connection tokens.

---

## Request Pipeline

Every API call flows through `requestCore()`, which handles the HTTP mechanics.

### URL Building

```ts
// Base URL + path + query string
const fullUrl = `${apiBaseUrl}${path}${queryString}`;

// Example:
// apiBaseUrl: "https://api.aluvia.io/v1"
// path: "/account/connections"
// query: { start: "123", end: "456" }
// Result: "https://api.aluvia.io/v1/account/connections?start=123&end=456"
```

**Query string rules:**

- `null` and `undefined` values are **omitted**
- Arrays become repeated keys: `{ k: ['a', 'b'] }` → `?k=a&k=b`
- All values are converted to strings

### Headers

Every request includes these headers:

| Header | Value | When |
|--------|-------|------|
| `Authorization` | `Bearer <apiKey>` | Always |
| `Accept` | `application/json` | Always |
| `Content-Type` | `application/json` | When body is provided |
| `If-None-Match` | `<etag>` | When etag option is provided |

### Timeout

Requests use `AbortController` for timeout enforcement:

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

const response = await fetch(url, { signal: controller.signal });
```

On timeout, `requestCore` throws:

```ts
throw new ApiError(`Request timed out after ${timeoutMs}ms`, 408);
```

Default timeout is **30,000ms** (30 seconds).

### Response Parsing

1. **Status 204 or 304:** Returns `{ status, etag, body: null }`
2. **Non-JSON Content-Type:** Returns `{ status, etag, body: null }`
3. **JSON Content-Type:** Parses body and returns `{ status, etag, body: parsedJson }`

The `etag` is captured from the `ETag` response header for conditional request support.

---

## Response Handling

### Success Envelope

The Aluvia API wraps successful responses in an envelope:

```ts
// Standard envelope
{
  "success": true,
  "data": { ... }
}

// Simplified envelope (also accepted)
{
  "data": { ... }
}
```

High-level helpers automatically unwrap the `data` field. You receive the inner data directly:

```ts
// API returns: { "success": true, "data": { "id": "123", "balance_gb": 50 } }
// You receive: { "id": "123", "balance_gb": 50 }
const account = await api.account.get();
console.log(account.balance_gb); // 50
```

### Error Envelope

Error responses follow this structure:

```ts
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "Validation failed.",
    "details": {
      "field": ["Error message"]
    }
  }
}
```

High-level helpers convert these to `ApiError`:

```ts
throw new ApiError(
  'API request failed (HTTP 422) code=validation_error message=Validation failed. details={"field":["Error message"]}',
  422
);
```

### ETag / Conditional Requests

The `api.account.connections.get()` method supports conditional requests:

```ts
// First request — no etag
const conn1 = await api.account.connections.get('123');
// Save the etag from the response (available via low-level request)

// Subsequent request with etag
const conn2 = await api.account.connections.get('123', { etag: '"abc123"' });

if (conn2 === null) {
  // Server returned 304 Not Modified
  // Connection unchanged, use cached version
}
```

This is useful for efficient polling without re-transferring unchanged data.

---

## Error Handling

### Error Classes

```ts
import {
  MissingApiKeyError,
  InvalidApiKeyError,
  ApiError,
} from '@aluvia/sdk';
```

| Error Class | When Thrown |
|-------------|-------------|
| `MissingApiKeyError` | `apiKey` is empty or whitespace in constructor. |
| `InvalidApiKeyError` | API returns `401 Unauthorized` or `403 Forbidden`. |
| `ApiError` | All other API errors (4xx, 5xx), malformed responses, timeouts. |

### InvalidApiKeyError

Thrown for authentication failures:

```ts
try {
  const account = await api.account.get();
} catch (error) {
  if (error instanceof InvalidApiKeyError) {
    // Message includes guidance about token type
    console.error(error.message);
    // "Authentication failed (HTTP 401). Check token validity and that you 
    //  are using an account API token for account endpoints."
  }
}
```

### ApiError

Thrown for non-auth API failures:

```ts
try {
  await api.account.connections.create({});
} catch (error) {
  if (error instanceof ApiError) {
    console.error('Message:', error.message);
    console.error('Status:', error.statusCode);
    
    // Possible statusCode values:
    // - 400: Bad request
    // - 404: Not found
    // - 422: Validation error
    // - 408: Timeout (from AbortController)
    // - 500: Server error
  }
}
```

### Timeout Errors

Timeouts are reported as `ApiError` with `statusCode: 408`:

```ts
const api = new AluviaApi({
  apiKey: 'test-key',
  timeoutMs: 5000, // 5 seconds
});

try {
  await api.account.get();
} catch (error) {
  if (error instanceof ApiError && error.statusCode === 408) {
    console.error('Request timed out');
  }
}
```

### Complete Error Handling Pattern

```ts
import { AluviaApi, MissingApiKeyError, InvalidApiKeyError, ApiError } from '@aluvia/sdk';

async function safeApiCall() {
  try {
    const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });
    const account = await api.account.get();
    return account;
    
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      console.error('Configuration error: API key is required');
      
    } else if (error instanceof InvalidApiKeyError) {
      console.error('Authentication failed. Check your API key.');
      console.error('Note: Account endpoints require an account API token.');
      
    } else if (error instanceof ApiError) {
      if (error.statusCode === 408) {
        console.error('Request timed out. Retry with exponential backoff.');
      } else if (error.statusCode === 404) {
        console.error('Resource not found.');
      } else if (error.statusCode === 422) {
        console.error('Validation error:', error.message);
      } else {
        console.error('API error:', error.message);
      }
      
    } else {
      // Network error or unexpected error
      throw error;
    }
  }
}
```

---

## Low-Level Access

### `api.request(args)`

For cases where high-level helpers don't fit, use the direct request method:

```ts
const result = await api.request({
  method: 'GET',
  path: '/account',
  query: { foo: 'bar' },
  headers: { 'X-Custom': 'value' },
  body: { data: 'value' }, // For POST/PATCH
});

console.log(result.status);  // HTTP status code
console.log(result.etag);    // ETag header value (or null)
console.log(result.body);    // Parsed JSON body (or null)
```

**Key differences from high-level helpers:**

| Aspect | High-Level Helpers | `api.request()` |
|--------|-------------------|-----------------|
| Success envelope | Automatically unwrapped | Raw body returned |
| Error handling | Throws on non-2xx | Returns status, you decide |
| 304 handling | Returns `null` (get only) | Returns `{ status: 304, body: null }` |
| Types | Strongly typed returns | `body: unknown` |

### Request Arguments

```ts
type AluviaApiRequestArgs = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
};
```

### Use Cases for Low-Level Access

```ts
// Handle non-2xx without exceptions
const result = await api.request({
  method: 'GET',
  path: `/account/connections/${id}`,
});

if (result.status === 404) {
  console.log('Connection not found');
} else if (result.status === 200) {
  const data = (result.body as any)?.data;
  console.log('Connection:', data);
}

// Capture ETag for conditional requests
const result = await api.request({
  method: 'GET',
  path: '/account/connections/123',
});

const etag = result.etag;
console.log('ETag:', etag); // '"abc123"'

// Later: conditional request
const result2 = await api.request({
  method: 'GET',
  path: '/account/connections/123',
  headers: { 'If-None-Match': etag! },
});

if (result2.status === 304) {
  console.log('Not modified');
}
```

---

## Types

All types are exported from the main package:

```ts
import type {
  // Response types
  Account,
  AccountUsage,
  AccountPayment,
  AccountConnection,
  AccountConnectionDeleteResult,
  Geo,
  
  // Envelope types
  SuccessEnvelope,
  ErrorEnvelope,
  Envelope,
} from '@aluvia/sdk';
```

### AccountConnection

The most commonly used type:

```ts
type AccountConnection = {
  id?: string | number;
  connection_id?: string;
  proxy_username?: string;
  proxy_password?: string;
  rules?: string[];
  session_id?: string | null;
  target_geo?: string | null;
} & Record<string, unknown>;
```

### Envelope Types

```ts
type SuccessEnvelope<T> = {
  success: true;
  data: T;
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;
```

---

## Examples

### List All Connections with Details

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

async function listConnectionDetails() {
  const connections = await api.account.connections.list();
  
  for (const conn of connections) {
    const details = await api.account.connections.get(conn.connection_id!);
    console.log(`${details?.description}:`);
    console.log(`  ID: ${details?.connection_id}`);
    console.log(`  Rules: ${details?.rules?.join(', ')}`);
    console.log(`  Geo: ${details?.target_geo ?? 'none'}`);
  }
}
```

### Create Connection and Configure

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

async function setupNewConnection() {
  // Get available geos
  const geos = await api.geos.list();
  const nyGeo = geos.find(g => g.code === 'us-ny');
  
  // Create connection targeting New York
  const connection = await api.account.connections.create({
    description: 'my-ny-agent',
    rules: ['*', '-localhost'],
    target_geo: nyGeo?.code,
  });
  
  console.log('Created connection:', connection.connection_id);
  console.log('Proxy credentials:');
  console.log(`  Username: ${connection.proxy_username}`);
  console.log(`  Password: ${connection.proxy_password}`);
  
  // The api_token is only returned on creation
  console.log(`  API Token: ${connection.api_token}`);
  
  return connection;
}
```

### Monitor Usage

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

async function checkUsage() {
  const account = await api.account.get();
  const usage = await api.account.usage.get();
  
  console.log(`Balance: ${account.balance_gb} GB`);
  console.log(`Data used: ${usage.data_used_gb} GB`);
  console.log(`Remaining: ${(account.balance_gb as number) - (usage.data_used_gb as number)} GB`);
  
  if ((account.balance_gb as number) < 10) {
    console.warn('Warning: Low balance!');
  }
}
```

### Update Rules Dynamically

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

async function addHostToProxy(connectionId: string, hostname: string) {
  // Get current rules
  const connection = await api.account.connections.get(connectionId);
  const currentRules = connection?.rules ?? [];
  
  // Add new hostname if not already included
  if (!currentRules.includes(hostname)) {
    const newRules = [...currentRules, hostname];
    
    await api.account.connections.patch(connectionId, {
      rules: newRules,
    });
    
    console.log(`Added ${hostname} to proxy rules`);
  }
}
```

### Rotate Session

```ts
import { AluviaApi } from '@aluvia/sdk';
import { randomUUID } from 'crypto';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

async function rotateSession(connectionId: string) {
  const newSessionId = randomUUID();
  
  await api.account.connections.patch(connectionId, {
    session_id: newSessionId,
  });
  
  console.log(`Session rotated to: ${newSessionId}`);
  return newSessionId;
}
```

### Cleanup Unused Connections

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

async function cleanupConnections(keepDescription: string) {
  const connections = await api.account.connections.list();
  
  for (const conn of connections) {
    if (conn.description !== keepDescription) {
      await api.account.connections.delete(conn.connection_id!);
      console.log(`Deleted connection: ${conn.connection_id}`);
    }
  }
}
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `api.account.get()` | `GET /account` | Get account metadata |
| `api.account.usage.get()` | `GET /account/usage` | Get usage summary |
| `api.account.payments.list()` | `GET /account/payments` | List payments |
| `api.account.connections.list()` | `GET /account/connections` | List all connections |
| `api.account.connections.create()` | `POST /account/connections` | Create new connection |
| `api.account.connections.get()` | `GET /account/connections/:id` | Get single connection |
| `api.account.connections.patch()` | `PATCH /account/connections/:id` | Update connection |
| `api.account.connections.delete()` | `DELETE /account/connections/:id` | Delete connection |
| `api.geos.list()` | `GET /geos` | List available geos |
| `api.request()` | Any | Low-level escape hatch |

