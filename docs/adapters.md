## Proxy URL Adapters

Aluvia Client starts a **local HTTP proxy** and returns a session object from `client.start()`. The new **adapter methods** on that session format the proxy settings for common libraries so developers don’t have to remember each library’s proxy configuration shape.

### Mental model

- **One canonical proxy URL**: `session.url` (and `session.getUrl()`) is always `http://127.0.0.1:<port>`
- **Adapters are formatting helpers**: they do not change routing behavior; they only convert `session.url` into the shape your tool expects
- **Stop/cleanup**: `await session.close()` (alias of `await session.stop()`) shuts down the local proxy and stops config polling

### API surface (session methods)

- **`session.getUrl(): string`**
  - Returns the local proxy URL string.
  - Always the same value as `session.url`.

- **`session.asPlaywright(): { server: string }`**
  - Returns the object used by Playwright’s `launch({ proxy })`.

- **`session.asPuppeteer(): string[]`**
  - Returns Chromium args for Puppeteer’s `launch({ args })`.

- **`session.asNodeAgent(): Agent`**
  - Returns a cached Node HTTP(S) proxy agent (created on first call).
  - Intended for Axios, got, and node-fetch.

- **`session.close(): Promise<void>`**
  - Alias for `session.stop()`.

### Browser automation

### Playwright

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({ token: process.env.ALV_USER_TOKEN! });
const session = await client.start();

const browser = await chromium.launch({
  proxy: session.asPlaywright(),
});

const page = await browser.newPage();
await page.goto('https://example.com');

await browser.close();
await session.close();
```

What `asPlaywright()` returns:

```ts
{ server: 'http://127.0.0.1:<port>' }
```

### Puppeteer

```ts
import puppeteer from 'puppeteer';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({ token: process.env.ALV_USER_TOKEN! });
const session = await client.start();

const browser = await puppeteer.launch({
  args: session.asPuppeteer(),
});

await browser.close();
await session.close();
```

What `asPuppeteer()` returns:

```ts
['--proxy-server=http://127.0.0.1:<port>']
```

### HTTP clients and agent runtimes (Node)

### Axios

Axios has its own proxy feature which is **not** an HTTP proxy tunnel in the way you want here. When using a proxy agent, disable Axios proxy handling and pass the agent explicitly.

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({ token: process.env.ALV_USER_TOKEN! });
const session = await client.start();

const agent = session.asNodeAgent();

const response = await axios.get('https://api.example.com/data', {
  proxy: false,
  httpAgent: agent,
  httpsAgent: agent,
});

await session.close();
```

### got

```ts
import got from 'got';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({ token: process.env.ALV_USER_TOKEN! });
const session = await client.start();

const agent = session.asNodeAgent();

const response = await got('https://api.example.com/data', {
  agent: {
    http: agent,
    https: agent,
  },
});

await session.close();
```

### node-fetch

```ts
import fetch from 'node-fetch';
import { AluviaClient } from '@aluvia/aluvia-node';

const client = new AluviaClient({ token: process.env.ALV_USER_TOKEN! });
const session = await client.start();

const response = await fetch('https://api.example.com/data', {
  agent: session.asNodeAgent(),
});

await session.close();
```

### Generic URL (anything else)

If a library wants “a proxy URL string”, use:

```ts
const proxyUrl = session.getUrl();
```

This is always an `http://` URL because it describes a **local HTTP proxy endpoint**. It can still tunnel HTTPS destinations using `CONNECT`.

### Notes and caveats

- **Node built-in `fetch()`**: Node 18+ built-in `fetch()` uses undici and does not accept a Node `http.Agent` in the same way Axios/got/node-fetch do. For now, use got or node-fetch when you want an “agent-style” proxy integration.
- **`asNodeAgent()` caching**: repeated calls return the same agent instance. It’s created lazily, and it’s destroyed when you call `session.close()` / `session.stop()`.
- **Local-only by default**: the proxy is bound to `127.0.0.1` and is not reachable from other machines.

### Troubleshooting

- **Proxied requests are not going through Aluvia**
  - Confirm your routing rules include the hostname you’re calling.
  - Remember: routing is **hostname-only**, not path-based.

- **Axios ignores the agent**
  - Ensure `proxy: false` is set.
  - Ensure you pass both `httpAgent` and `httpsAgent`.

- **Puppeteer launches but traffic isn’t proxied**
  - Make sure you passed `args: session.asPuppeteer()` to `puppeteer.launch()`.
  - If you also set other Chromium proxy flags manually, remove them to avoid conflicts.

### What’s next

- **Selenium adapter**: planned as a follow-up (`session.asSelenium()`), since Selenium’s proxy configuration varies by language and driver setup.
