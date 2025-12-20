
## Objective

Extend the Aluvia control plane into a **Node.js API wrapper** so developers can do (via this SDK) everything they can do via the Aluvia HTTP API for the subset below, while keeping the existing proxy/connection behavior working end-to-end.

This plan is written for an AI agent to execute. Steps are intentionally **atomic** and include explicit file touch-points, tests, and acceptance criteria.

## In-scope endpoints (must be supported)

- `GET /account`
- `GET /account/usage`
- `GET /account/payments`
- `GET /account/connections`
- `POST /account/connections`
- `GET /account/connections/{connection_id}`
- `PATCH /account/connections/{connection_id}`
- `DELETE /account/connections/{connection_id}`
- `GET /geos`

## Out of scope (do not implement)

- `GET /connection` (self)
- `PATCH /connection` (self)

## Global acceptance criteria

- All in-scope endpoints have a first-class SDK helper.
- SDK supports:
  - base URL override (`apiBaseUrl`)
  - Bearer auth header
  - timeouts (configurable)
  - consistent error handling for non-2xx responses
  - ETag capture on responses, and `If-None-Match` support for conditional GETs
- `npm test` passes.
- `npm run build` passes (ESM + CJS + types).

## Design decisions (make these first, then implement)

- **SDK surface**:
  - Add an `api` facade with grouped methods: `client.api.account.*` and `client.api.geos.*`
  - Provide a low-level escape hatch: `client.api.request(...)`
- **Return conventions**:
  - “High-level” helpers return unwrapped `data` from the API success envelope.
  - A `request(...)` method returns `{ status, etag, body }` for callers who need headers/status.
- **Error conventions**:
  - Non-2xx throws `ApiError` (reuse `src/errors.ts`) with `statusCode`.
  - When possible, include server error payload (`code`, `message`, `details`) in the thrown error message.
- **Types**:
  - Phase 4 decides between (A) OpenAPI-generated types or (B) minimal hand-written types for the in-scope endpoints.
  - Choose one approach and apply consistently across wrapper + tests + exports.

---

## Phase 1: Audit + SDK surface proposal

### Step 1.1: Confirm current control-plane touch points

- **Read** `src/ConfigManager.ts` and note:
  - where it calls `/account/connections/:id` and how it uses `etag`
  - what fields it requires from API responses (proxy creds, rules, session_id, target_geo)
- **Read** `src/AluviaClient.ts` and note:
  - how it constructs connection adapters from `ConfigManager.getConfig()`
- **Read** `test/integration.test.ts` and note:
  - existing tests that assert ETag header behavior and POST body behavior

**Done when**
- You can list the exact call sites that need to be migrated to the new API wrapper.

### Step 1.2: Decide the module layout (write it down before coding)

Create a short “API surface” spec for the agent to implement:

- **New public export**: `AluviaApi` (or `AluviaApiClient`) and/or `AluviaClient.api`
- **Recommended module layout** (concrete and small):
  - `src/api/AluviaApi.ts` (public facade; owns token/baseUrl/timeout/fetch)
  - `src/api/request.ts` (single request core; builds URL, headers, parses JSON, handles timeout)
  - `src/api/account.ts` (account group methods)
  - `src/api/geos.ts` (geos group methods)
  - `src/api/types.ts` (types for request/response envelopes + the in-scope schemas)

**Done when**
- You have a written decision for:
  - file layout
  - method names
  - return types
  - error behavior

### Step 1.3: Update the plan’s endpoint-to-helper mapping

Write the exact mapping the agent will implement:

- `client.api.account.get() -> GET /account`
- `client.api.account.usage.get({ start?, end? }) -> GET /account/usage`
- `client.api.account.payments.list({ start?, end? }) -> GET /account/payments`
- `client.api.account.connections.list() -> GET /account/connections`
- `client.api.account.connections.create(body) -> POST /account/connections`
- `client.api.account.connections.get(connectionId, { etag? }) -> GET /account/connections/{connection_id}`
- `client.api.account.connections.patch(connectionId, body) -> PATCH /account/connections/{connection_id}`
- `client.api.account.connections.delete(connectionId) -> DELETE /account/connections/{connection_id}`
- `client.api.geos.list() -> GET /geos`
- `client.api.request({ method, path, query?, body?, headers? }) -> generic`

**Done when**
- The mapping is present and unambiguous (parameter names + shapes specified).

---

## Phase 2: Introduce unified request core (no new endpoints yet)

### Step 2.1: Add a single request core with timeout + ETag support

- **Create** `src/api/request.ts` implementing:
  - base URL join (no double slashes)
  - query serialization
  - headers:
    - `Authorization: Bearer <token>`
    - `Accept: application/json`
    - `Content-Type: application/json` only when sending JSON body
    - `If-None-Match` when provided
  - timeout via `AbortController`
  - response handling:
    - capture `etag` response header (case-insensitive)
    - parse JSON on non-204 responses when content-type is JSON
    - return `{ status, etag, body }`

**Tests**
- Extend `test/integration.test.ts` (or add a new file if you also update the test script) to verify:
  - `If-None-Match` is sent when provided
  - JSON body is stringified on POST/PATCH
  - `etag` is captured from response headers
  - timeout aborts fetch (mock fetch that never resolves; assert rejection)

**Done when**
- Request core exists with tests, and is used by at least one call site (can be a temporary “smoke” request).

### Step 2.2: Wire the existing control plane through the new request core

Even though backward compatibility is not required, keep behavior working:

- **Update** `src/ConfigManager.ts` to stop importing from `src/httpClient.ts`.
- Replace those calls with the new API wrapper calls (introduced in Phase 3) or temporarily call the request core directly for:
  - `GET /account/connections/{connection_id}` with `If-None-Match` polling
  - `POST /account/connections` when no `connection_id` provided
  - `PATCH /account/connections/{connection_id}` for updates

**Tests**
- Add/adjust tests to ensure polling logic still:
  - sends `If-None-Match` with last `etag`
  - treats `304` as “no update”

**Done when**
- `AluviaClient.start()` continues to work in both modes under the existing tests (after updating mocks if needed).

---

## Phase 3: Add missing endpoint helpers (Account → Geos)

### Step 3.1: Implement the API facade and resource groups

- **Create** `src/api/AluviaApi.ts`:
  - constructor takes `{ apiKey, apiBaseUrl, timeoutMs?, logLevel?, fetch? }`
  - exposes:
    - `request(...)`
    - `account` group
    - `geos` group

- **Create** `src/api/account.ts` implementing:
  - `get()`
  - `usage.get({ start?, end? })`
  - `payments.list({ start?, end? })`
  - `connections.list()`
  - `connections.create(body)`
  - `connections.get(connectionId, { etag? })`
  - `connections.patch(connectionId, body)`
  - `connections.delete(connectionId)`

- **Create** `src/api/geos.ts` implementing:
  - `list()`

**Implementation notes**
- Treat `connection_id` as `string | number` at the boundary; serialize to path string.
- For `start`/`end` query params, only include them if not `null`/`undefined`.
- For `DELETE`, accept and return the API’s `{ success: true, data: { connection_id, deleted } }` shape and unwrap it.

**Done when**
- All in-scope endpoints are callable via the facade.

### Step 3.2: Integrate the API facade into the main client

- **Update** `src/AluviaClient.ts`:
  - Instantiate `this.api = new AluviaApi(...)` with the same `apiKey` and `apiBaseUrl`.
  - Expose it publicly as `client.api`.

- **Update** `src/index.ts` to export `AluviaApi` (and any public types chosen in Phase 4).

**Done when**
- Consumer can:
  - `const client = new AluviaClient(...);`
  - call `client.api.account.get()` without starting the proxy.

### Step 3.3: Update (or replace) `src/httpClient.ts`

Choose one:

- **Option A (recommended)**: delete `src/httpClient.ts` entirely and remove its imports.
- **Option B**: keep it but turn it into a thin re-export of the new API calls for internal use.

**Done when**
- There is a single source of truth for HTTP calls (the request core).

### Step 3.4: Add endpoint-level tests for each helper

Add request-shape tests (mock `globalThis.fetch`) verifying for each endpoint:

- correct HTTP method
- correct URL path
- correct query string
- correct headers
- correct JSON encoding for bodies
- correct unwrapping of `{ success: true, data }`
- correct thrown error on `{ success: false, error }` or non-2xx

Also add at least one test per endpoint that simulates a non-2xx response:
- 401/403 maps to `InvalidApiKeyError` (or `ApiError` if you choose a different standard, but be consistent)
- 422 returns useful message

**Done when**
- Tests exist covering all nine endpoints.

---

## Phase 4: Types + docs

### Step 4.1: Choose and implement a typing strategy

Pick exactly one:

- **Option A: Generate types from OpenAPI** (preferred for drift resistance)
  - Add dev dependency: `openapi-typescript`
  - Add script: `npm run generate:openapi`
  - Generate to: `src/api/generated.ts` (commit the output)
  - Reference generated types from wrapper methods

- **Option B: Minimal hand-written types** (fewer dependencies, faster)
  - Implement in `src/api/types.ts`:
    - `SuccessEnvelope<T>`, `ErrorEnvelope`
    - schemas needed by the in-scope endpoints (AccountData, UsageData, PaymentsData, Connection* shapes, GeoItem)

**Done when**
- Wrapper methods have accurate TS signatures for inputs/outputs.

### Step 4.2: Export public types

- **Update** `src/index.ts` exports to include:
  - API wrapper type(s)
  - endpoint schema types (at minimum the ones returned from helpers)

**Done when**
- A consumer can import types from the package entrypoint without deep-imports.

### Step 4.3: Update docs

- **Update** `README.md`:
  - Add a section “API wrapper” with examples:
    - `client.api.account.get()`
    - `client.api.account.connections.list()`
    - `client.api.geos.list()`
  - Clarify that `/connection` endpoints are not implemented by design.

- **Optional**: Update `ai_agent_setup/projectdoc.md` to reflect the new public surface (`client.api`).

**Done when**
- README examples compile conceptually and match exported APIs.

---

## Phase 5: Hardening (reliability + edge cases)

### Step 5.1: Standardize timeout + retry behavior

- Ensure every request uses a default timeout (configurable).
- Add safe retry policy (if implemented):
  - network errors
  - 429 with backoff (respect `Retry-After` when present)
  - 5xx with backoff
- Do not retry non-idempotent requests unless explicitly safe and documented.

**Done when**
- Timeout is enforced everywhere, and tests cover the timeout path.

### Step 5.2: Finalize ETag/304 conventions

- Define behavior for:
  - `GET` with `If-None-Match` returning `304`:
    - wrapper should return `{ status: 304, etag, body: null }` via `request(...)`
    - higher-level helpers may either:
      - return `null` to represent “no new data”, or
      - expose a `getWithEtag(...)` variant for polling code paths
- Ensure `ConfigManager` polling uses the chosen convention consistently.

**Done when**
- `ConfigManager` polling is clean, predictable, and tested with 200→304→200 sequences.

### Step 5.3: Error messages that help users self-diagnose

- For `{ success: false, error }`, include:
  - HTTP status
  - `error.code`
  - `error.message`
  - a compact representation of `error.details` (if present)
- For 401/403, message should suggest “check token type and validity”.

**Done when**
- A developer can diagnose common failures from the thrown error message alone.

---

## Execution checklist (what to run locally at key milestones)

- After Phase 2: `npm test`
- After Phase 3: `npm test`
- After Phase 4: `npm run build`
- After Phase 5: `npm test && npm run build`


