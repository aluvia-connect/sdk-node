# Aluvia Node.js SDK

[![npm](https://img.shields.io/npm/v/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![downloads](https://img.shields.io/npm/dm/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![license](https://img.shields.io/npm/l/@aluvia/sdk.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@aluvia/sdk.svg)](./package.json)

## Overview

AI agents that work locally often fail in production. When you deploy to cloud infrastructure, requests encounter:

- **403 Forbidden** responses
- **CAPTCHAs** and verification challenges
- **Rate limiting** after a few requests

Cloud providers use well-known IP ranges that bot detection systems flag as high-risk.

**Aluvia solves this** by routing traffic through US mobile carrier IPs. Traffic from mobile IPs appears identical to traffic from real mobile users.

| Benefit | Description |
|---------|-------------|
| **Unblock sites** | Mobile IPs bypass datacenter IP blocking |
| **Reduce costs** | Route only blocked sites through Aluvia; other traffic goes direct |
| **Update at runtime** | Change routing rules without restarting your agent |
| **Unified API** | Single SDK with adapters for Playwright, Puppeteer, Axios, and more |

---

## Quick start

### Before you begin

1. Create an account at [app.aluvia.io](https://app.aluvia.io)
2. Go to **Settings > API Keys** and create an **Account API Key**

### Install the SDK

```bash
npm install @aluvia/sdk
```

**Requirements:** Node.js 18 or later

### Example: Aluvia client + Playwright

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

const browser = await chromium.launch({ proxy: connection.asPlaywright() });
const page = await browser.newPage();
await page.goto('https://example.com');

await browser.close();
await connection.close();
```

### Example: Aluvia client + Axios

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

await client.updateRules(['target-site.com']); // Proxy only this hostname

const response = await axios.get('https://target-site.com', connection.asAxiosConfig());
await connection.close();
```

---

## How it works

```
┌──────────────────┐      ┌──────────────────────────┐      ┌──────────────────────┐
│                  │      │                          │      │                      │
│    Your Agent    │─────▶     Aluvia Client         ─────▶  gateway.aluvia.io    │
│                  │      │     127.0.0.1:port       │      │    (Mobile IPs)      │
│                  │      │                          │      │                      │
└──────────────────┘      │  Per-request routing:    │      └──────────────────────┘
                          │                          │
                          │  api.stripe.com ──────────────▶ Direct (free)
                          │  target-site.com ─────────────▶ Via Aluvia
                          │                          │
                          └──────────────────────────┘
```

The Aluvia Client starts a local proxy server that routes each request either directly or through Aluvia, based on hostname rules. You can update rules at runtime without restarting your agent.

---

## Guides

### Background:
* [What is Aluvia?](https://docs.aluvia.io/)
* [Aluvia fundamentals](https://docs.aluvia.io/fundamentals/connections)

### Aluvia Client:
* [Client technical docs](docs/client-technical-guide.md)
* [How to create a new connection](https://docs.aluvia.io/connect/create-connection)
* [How to use a connection](https://docs.aluvia.io/connect/use-connection)
* [How to manage a connection](https://docs.aluvia.io/connect/manage-connection)

---

## Understanding Aluvia connections

A **connection** is a set of credentials and configuration that defines how your agent connects to Aluvia.

| Attribute | Description |
|-----------|-------------|
| **Connection ID** | Unique identifier. Pass to `AluviaClient` to reuse an existing connection. |
| **Routing rules** | Hostnames to route through Aluvia versus direct. |
| **Session ID** | Controls IP rotation and sticky sessions. |
| **Target geo** | Geographic targeting for IPs (for example, `us-ny`). |

**Key points:**
- Create as many connections as you need
- You can update rules at runtime
- Connections remain active until you delete them

You can manage connections through the [Dashboard](https://app.aluvia.io), this SDK (`AluivaApi`), or [REST API](docs/api-technical-guide.md). 

For more information, see [Understanding Connections](https://docs.aluvia.io/fundamentals/connections).

---

## Routing rules

Route traffic to Aluvia using custom hostname routing rules that you (or our agent) set. 

* Selectively routing traffic to mobile proxies results in significant cost savings. 
* Rules can be updated during runtime, allowing agents to work around website blocks on the fly.

```ts
await client.updateRules(['*']);                              // Proxy all traffic
await client.updateRules(['target-site.com', '*.google.com']); // Proxy specific hosts
await client.updateRules(['*', '-api.stripe.com']);           // Proxy all except specified
await client.updateRules([]);                                 // Route all traffic direct
```

### Supported patterns:

| Pattern | Matches |
|---------|---------|
| `*` | All hostnames |
| `example.com` | Exact match |
| `*.example.com` | Subdomains of example.com |
| `google.*` | google.com, google.co.uk, and similar |
| `-example.com` | Exclude from proxying |


### Example: Unblocking websites at runtime

An agent browses the web to complete a task. When a website blocks the agent, it dynamically adds a hostname rule to route that site's traffic through Aluvia's mobile IPs—without restarting the browser.

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
});

const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

// Track which hostnames we've added rules for
const proxiedHosts = new Set<string>();

async function visitWithRetry(url: string): Promise<string> {
  const page = await browser.newPage();

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    const hostname = new URL(url).hostname;

    // Detect block: 403, 429, or a challenge page
    const status = response?.status() ?? 0;
    const isBlocked =
      status === 403 ||
      status === 429 ||
      (await page.title()).toLowerCase().includes('blocked');

    if (isBlocked && !proxiedHosts.has(hostname)) {
      console.log(`Blocked by ${hostname} — adding to proxy rules`);

      // Add the hostname to routing rules (updates take effect immediately)
      proxiedHosts.add(hostname);
      await client.updateRules([...proxiedHosts]);

      // Retry with the new rule in place
      await page.close();
      return visitWithRetry(url);
    }

    return await page.content();
  } finally {
    await page.close();
  }
}

try {
  // First attempt may be blocked; SDK will proxy on retry
  const html = await visitWithRetry('https://example.com/data');
  console.log('Success:', html.slice(0, 200));
} finally {
  await browser.close();
  await connection.close();
}
```

---

## Tool adapters

Every tool has its own way of configuring proxies—Playwright wants { server, username, password }, Puppeteer wants CLI args, Axios wants agents, and Node's native fetch doesn't support proxies at all. The SDK handles all of this for you:

| Tool | Method | Returns |
|------|--------|---------|
| Playwright | `connection.asPlaywright()` | `{ server, username?, password? }` |
| Puppeteer | `connection.asPuppeteer()` | `['--proxy-server=...']` |
| Selenium | `connection.asSelenium()` | `'--proxy-server=...'` |
| Axios | `connection.asAxiosConfig()` | `{ proxy: false, httpAgent, httpsAgent }` |
| got | `connection.asGotOptions()` | `{ agent: { http, https } }` |
| fetch | `connection.asUndiciFetch()` | Proxy-enabled `fetch` function |
| Node.js http | `connection.asNodeAgents()` | `{ http: Agent, https: Agent }` |

---

## Aluvia API

The SDK includes a typed client for managing connections programmatically:

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

const account = await api.account.get();
const connections = await api.account.connections.list();
const newConnection = await api.account.connections.create({ description: 'my-agent' });
```

For the complete API reference, see [API Technical Guide](docs/api-technical-guide.md).

---

## Additional resources

- [What is Aluvia?](https://docs.aluvia.io/)
- [Client Technical Guide](docs/client-technical-guide.md)
- [API Technical Guide](docs/api-technical-guide.md)
- [Self-healing recovery pattern](docs/client-technical-guide.md#example)

---

## License

MIT — see [LICENSE](./LICENSE)
