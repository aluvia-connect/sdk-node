# Aluvia Node.js SDK

[![npm](https://img.shields.io/npm/v/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![downloads](https://img.shields.io/npm/dm/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![license](https://img.shields.io/npm/l/@aluvia/sdk.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@aluvia/sdk.svg)](./package.json)


**AI agents running in the cloud get blocked. A lot.**

There are two key components:
1. Aluvia client - lets agents route traffic through Aluvia's trusted US mobile IP addresses instead of their own cloud/datacenter IPs. Reduces website blocks and allows for reliable agent workflows at scale.
2. API wrapper - a JavaScript wrapper for the Aluvia API

Websites see datacenter IPs, trigger CAPTCHAs, return 403s, rate-limit with 429s—and your carefully orchestrated workflow breaks. Aluvia fixes this by routing your agent's traffic through trusted US mobile IP addresses, making your agent appear as a real user instead of a bot.

---

## Key Benefits

**Improve agent reliability**
- **Problem:** Agents run in the cloud, but websites treat datacenter traffic as higher-risk—resulting in CAPTCHAs, rate limits (429), blocks (403), and broken workflows.
- **Solution:** Route requests through Aluvia's mobile IP addresses, dramatically reducing blocks and increasing end-to-end workflow completion.

**Reduce proxy costs**
- **Problem:** Routing all traffic through mobile proxies is expensive and adds latency.
- **Solution:** Use hostname-based routing rules to proxy only the sites that need it. In typical workloads, this reduces bandwidth usage by 70-90%.

**Unblock workflows without restarts**
- **Problem:** Adjusting proxy settings usually requires restarting workers or redeploying.
- **Solution:** Update routing rules at runtime—agents can dynamically respond to blocks without restarts.

**Simplify integration**
- **Problem:** Every tool (Playwright, Puppeteer, Axios, etc.) configures proxies differently.
- **Solution:** One SDK with adapters for all major tools. No need to learn each library's quirks.

---

## How It Works

```
┌─────────────────┐      ┌─────────────────────────┐      ┌─────────────────────┐
│    Your Agent   │─────▶│     Aluvia SDK          │─────▶│  gateway.aluvia.io  │
│   (Playwright,  │      │    127.0.0.1:port       │      │   (Mobile IPs)      │
│   Axios, etc.)  │      │                         │      └─────────────────────┘
└─────────────────┘      │  Per-request routing:   │                │
                         │                         │                ▼
                         │  • api.stripe.com ────────────────▶ Direct (free, fast)
                         │  • cdn.jsdelivr.net ──────────────▶ Direct (free, fast)
                         │  • target-site.com ───────────────▶ Via Aluvia (unblocked)
                         └─────────────────────────┘
```

The SDK runs a local proxy server that decides **per request** whether to route traffic direct or through Aluvia (for sites that block datacenter IPs). You control routing with simple hostname rules, and can update rules at runtime without restarting your agent.

---

## Documentation

### The basics:
* [What is Aluvia?](https://docs.aluvia.io/)
* [Understanding Aluvia connections](https://docs.aluvia.io/fundamentals/connections)

### Get started:
* [Aluiva client - complete technical docs](docs/client-technical-guide.md)
* [How to create a new connection](https://docs.aluvia.io/connect/create-connection)
* [How to use a connection](https://docs.aluvia.io/connect/use-connection)
* [How to manage a connection](https://docs.aluvia.io/connect/manage-connection)

---

## Install

```bash
npm install @aluvia/sdk
```

**Requirements:** Node.js 18+

---

## Quick Start

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

const page = await browser.newPage();
await page.goto('https://example.com');

await browser.close();
await connection.close();
```

---

## Why Agents Use Aluvia: Self-Healing Recovery

When a website blocks your agent, it can **automatically add that hostname to the proxy rules and retry**—without restarting the browser or redeploying:

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

      // Add the hostname to routing rules (takes effect immediately)
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

**What makes this powerful:**
- No browser restart required—rules update instantly
- Agent learns which sites need proxying as it runs
- Minimizes proxy usage (and cost) by only proxying what's necessary

---

## Routing Rules

Control which hostnames go through Aluvia:

```ts
// Proxy everything
await client.updateRules(['*']);

// Proxy only specific hosts
await client.updateRules(['target-site.com', '*.example.com']);

// Proxy everything except certain hosts
await client.updateRules(['*', '-api.stripe.com', '-*.cdn.com']);

// Clear rules (all traffic goes direct)
await client.updateRules([]);
```

**Rule patterns:**
- `*` — matches any hostname
- `example.com` — exact match
- `*.example.com` — matches subdomains (not `example.com` itself)
- `google.*` — matches `google.com`, `google.co.uk`, etc.
- `-example.com` — exclude from proxying (takes precedence)

---

## Simplified Tool Integration

Every tool has its own way of configuring proxies—Playwright wants `{ server, username, password }`, Puppeteer wants CLI args, Axios wants agents, and Node's native `fetch` doesn't support proxies at all. The SDK handles all of this for you:

| Tool | Adapter | Returns |
|------|---------|---------|
| **Playwright** | `connection.asPlaywright()` | `{ server, username?, password? }` |
| **Puppeteer** | `connection.asPuppeteer()` | `['--proxy-server=...']` |
| **Selenium** | `connection.asSelenium()` | `'--proxy-server=...'` |
| **Axios** | `connection.asAxiosConfig()` | `{ proxy: false, httpAgent, httpsAgent }` |
| **got** | `connection.asGotOptions()` | `{ agent: { http, https } }` |
| **fetch (undici)** | `connection.asUndiciFetch()` | `fetch` function with proxy support |
| **Node.js http** | `connection.asNodeAgents()` | `{ http: Agent, https: Agent }` |

One connection, any tool—no need to learn each library's proxy quirks.

---

## Aluvia API

The SDK also includes a typed wrapper for the Aluvia REST API—useful for programmatically managing connections in multi-tenant agent platforms:

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

// Check account balance before expensive operations
const account = await api.account.get();
console.log(`Balance: ${account.balance_gb} GB`);

// List and manage connections
const connections = await api.account.connections.list();
const newConn = await api.account.connections.create({ description: 'my-agent' });
```

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `api.account.get()` | `GET /account` | Account metadata and balance |
| `api.account.usage.get()` | `GET /account/usage` | Usage summary (GB consumed) |
| `api.account.payments.list()` | `GET /account/payments` | Payment history |
| `api.account.connections.list()` | `GET /account/connections` | List all connections |
| `api.account.connections.create()` | `POST /account/connections` | Create new connection |
| `api.account.connections.get()` | `GET /account/connections/:id` | Get connection details |
| `api.account.connections.patch()` | `PATCH /account/connections/:id` | Update connection |
| `api.account.connections.delete()` | `DELETE /account/connections/:id` | Delete connection |
| `api.geos.list()` | `GET /geos` | List available geo targets |
| `api.request()` | Any | Low-level escape hatch |

For detailed documentation, see [API Technical Guide](docs/api-technical-guide.md) or the [REST API reference](https://docs.aluvia.io/api/api-reference/aluvia-api-v-1).

---

## License

MIT License - see [LICENSE](./LICENSE) for details.