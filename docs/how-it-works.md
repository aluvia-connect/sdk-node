## How it works

Aluvia Client has two parts:

- **Control plane (configuration)**: fetches and refreshes your user’s proxy credentials + routing rules from the Aluvia API
- **Data plane (proxy)**: a local proxy that decides per-request whether to go **direct** or **via Aluvia**

### Control plane: fetching configuration from Aluvia

On `client.start()`, the client calls the Aluvia API:

- **GET** `/user` (at `apiBaseUrl`, default `https://api.aluvia.io/v1`)
- Header: `Authorization: Bearer <ALV_USER_TOKEN>`

The response includes (among other fields):

- `proxy_username`, `proxy_password`: credentials used to connect to the Aluvia gateway
- `rules`: hostname-based routing rules
- `session_id`, `target_geo`: targeting metadata (exposed for rule/targeting updates)

The client builds an upstream gateway proxy from that configuration:

- **Host**: `gateway.aluvia.io`
- **Protocol**: `gatewayProtocol` (`http` by default)
- **Port**: `gatewayPort` (defaults to `8080` for `http`, `8443` for `https`)

### Live updates: polling with ETag

After the initial `GET /user`, the client periodically refreshes configuration every `pollIntervalMs` (default `5000` ms).

To avoid refetching config when nothing changed, the client uses **ETag-based conditional requests**:

- The API returns `ETag` on `GET /user`
- The client sends `If-None-Match: <etag>` on subsequent polls
- The API replies:
  - `304 Not Modified`: keep the current config
  - `200 OK`: update credentials/rules/targeting and store the new `ETag`

If a poll fails (network error or non-200/304 response), the client logs a warning and **keeps the last known-good configuration**, so the proxy can continue operating.

### Data plane: local proxy + per-request routing

The client starts a **local HTTP proxy** bound to `127.0.0.1` on either:

- the `localPort` you provide, or
- an OS-assigned free port (when `localPort` is omitted)

For each request, the proxy:

- extracts the **hostname** from the request
- evaluates that hostname against the current `rules`
- decides:
  - **Direct** (no upstream proxy), or
  - **Via Aluvia** (upstream proxy is the Aluvia gateway with your current credentials)

Because the proxy consults the current in-memory config on every request, rule/credential changes take effect **without restarting your agent**.



## Error handling

Aluvia Client throws typed errors to help you distinguish configuration issues from runtime failures:

- `MissingUserTokenError`: token not provided
- `InvalidUserTokenError`: API returned `401` or `403`
- `ApiError`: other non-200 responses from the Aluvia API
- `ProxyStartError`: local proxy failed to bind/start

## Operational notes

- **Security**: treat `ALV_USER_TOKEN` like a secret. Don’t ship it in code or client-side bundles.
- **Local-only**: the proxy binds to `127.0.0.1` (loopback) so it’s only accessible from the local machine.
- **Traffic selection is hostname-based**: if you need path-based behavior, implement it upstream (in your application) or split by host.
