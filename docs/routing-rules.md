## Routing rules

### What routing rules are (and why they matter)

Routing rules are how you tell Aluvia Client **which hostnames should be proxied through Aluvia** and which should go **direct**. The local proxy consults these rules on **every request**, so you can control traffic selection without changing your automation code.

Key benefits:

- **No restarts to change behavior**: update rules and running browsers/agents pick up the changes automatically (via polling) without restarting the proxy session.
- **Proxy only what matters**: send a small set of target domains through Aluvia while keeping everything else direct for lower latency and fewer moving parts.
- **Centralized control**: treat routing as configuration (managed in Aluvia or updated via `client.updateRules()`), not a per-project integration problem.

Rules are evaluated **against hostnames only** (not URL paths). Patterns are case-insensitive.

### How to use routing rules with Aluvia Client

Routing rules live on the **Aluvia user config** and are fetched from `GET /user`. There are two common ways to apply them:

- **Update rules in Aluvia**: if you change rules in the Aluvia UI/API, a running `AluviaClient` session will pick them up automatically on the next poll interval (default ~5s).
- **Update rules programmatically**: call `await client.updateRules([...])` to write the rules back to Aluvia (`PATCH /user`). The running proxy will then pick up the updated rules via polling.

Example:

```ts
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({ token: process.env.ALV_USER_TOKEN! });
const session = await client.start();

await client.updateRules(['*', '-example.com']);

// Your tool points at session.url / session.getUrl().
// The local proxy will now proxy everything except example.com.

await session.close();
```

### Supported patterns

- **`*`**: match any hostname
- **`example.com`**: exact match
- **`*.example.com`**: match subdomains (e.g., `foo.example.com`, `a.b.example.com`; does not match `example.com`)
- **`google.*`**: match TLD variations (e.g., `google.com`, `google.co.uk`)

### Negative rules (exclusions)

Prefix a pattern with `-` to exclude it:

- `['*', '-example.com']` proxies everything **except** `example.com`

Negative rules always win: if a hostname matches any exclusion, it will be routed direct.

### Practical rule sets (examples)

- `['example.com']` proxies only `example.com`
- `['*.example.com']` proxies subdomains like `api.example.com`, but not `example.com`
- `['*']` proxies everything
- `['*', '-example.com']` proxies everything except `example.com`

