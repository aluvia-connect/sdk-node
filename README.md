# Aluvia Node.js SDK

[![npm](https://img.shields.io/npm/v/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![downloads](https://img.shields.io/npm/dm/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![license](https://img.shields.io/npm/l/@aluvia/sdk.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@aluvia/sdk.svg)](./package.json)

## Introduction

AI agents require reliable web access, yet they often encounter 403 blocks, CAPTCHAs, and rate limits. Real humans don't live in datacenters, so websites often treat agent coming from datacenter/cloud IPs as suspicious.

**Aluvia solves this problem** by connecting agents to the web through premium mobile IPs on US carrier networks. Unlike datacenter IPs, these reputable IPs are used by real humans, and they don’t get blocked by websites.

**This Node.js SDK** makes it simple to integrate Aluvia into your agent workflow. There are two key components:
1. `AluviaClient` - a local client for connecting to Aluvia. 
2. `AluviaApi` - a lightweight JavaScript/TypeScript wrapper for the Aluvia REST API.

---

## Aluvia client

The Aluvia client runs a local rules-based proxy server on your agent's host, handles authentication and connection management, and provides ready-to-use adapters for popular tools like Playwright, Puppeteer, and Axios.

Simply point your automation tool at the local proxy address (`127.0.0.1`) and the client handles the rest. For each request, the client checks the destination hostname against user-defined (or agent-defined) routing rules and decides whether to send it through Aluvia's mobile IPs or direct to the destination.

```
┌──────────────────┐      ┌──────────────────────────┐      ┌──────────────────────┐
│                  │      │                          │      │                      │
│    Your Agent    │─────▶     Aluvia Client         ─────▶  gateway.aluvia.io    │
│                  │      │     127.0.0.1:port       │      │    (Mobile IPs)      │
│                  │      │                          │      │                      │
└──────────────────┘      │  Per-request routing:    │      └──────────────────────┘
                          │                          │
                          │  not-blocked.com ──────────────▶ Direct
                          │  blocked-site.com ─────────────▶ Via Aluvia
                          │                          │
                          └──────────────────────────┘
```

**Benefits:**

- **Avoid blocks:** Websites flag datacenter IPs as bot traffic, leading to 403s, CAPTCHAs, and rate limits. Mobile IPs appear as real users, so requests go through.
- **Reduce costs and latency:** Hostname-based routing rules let you proxy only the sites that need it. Traffic to non-blocked sites goes direct, saving money and reducing latency.
- **Unblock without restarts:** Rules update at runtime. When a site blocks your agent, add it to the proxy rules and retry—no need to restart workers or redeploy.
- **Simplify integration:** One SDK with ready-to-use adapters for Playwright, Puppeteer, Selenium, Axios, got, and Node's fetch.

---

## Quick start

### Understand the basics

- [What is Aluvia?](https://docs.aluvia.io/)
- [Understanding connections](https://docs.aluvia.io/fundamentals/connections)

### Get Aluvia API key

1. Create an account at [dashboard.aluvia.io](https://dashboard.aluvia.io)
2. Go to **API and SDKs** and get your **API Key**

### Install the SDK

```bash
npm install @aluvia/sdk
```

**Requirements:** Node.js 18 or later

### Example: Auto-launch Playwright browser

For even simpler setup, the SDK can automatically launch a Chromium browser that's already configured with the Aluvia proxy. This eliminates the need to manually import Playwright and configure proxy settings.

```ts
import { AluviaClient } from "@aluvia/sdk";

// Initialize with startPlaywright option to auto-launch browser
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  startPlaywright: true, // Automatically launch and configure Chromium
});

// Start the client - this also launches the browser
const connection = await client.start();

// Browser is already configured with Aluvia proxy
const browser = connection.browser;
const page = await browser.newPage();

// Configure geo targeting and session ID
await client.updateTargetGeo("us_ca");
await client.updateSessionId("session1");

// Navigate directly - proxy is already configured
await page.goto("https://example.com");
console.log("Title:", await page.title());

// Cleanup - automatically closes both browser and proxy
await connection.close();
```

**Note:** To use `startPlaywright: true`, you must install Playwright:

```bash
npx playwright install chromium
```

### Integration guides

The Aluvia client provides ready-to-use adapters for popular automation and HTTP tools:

- [Playwright](https://docs.aluvia.io/integrations/integration-playwright.md)
- [Puppeteer](https://docs.aluvia.io/integrations/integration-puppeteer.md)
- [Selenium](https://docs.aluvia.io/integrations/integration-selenium.md)
- [Axios](https://docs.aluvia.io/integrations/integration-axios.md)
- [got](https://docs.aluvia.io/integrations/integration-got.md)
- [fetch](https://docs.aluvia.io/integrations/integration-fetch.md)

---

## Architecture

The client is split into two independent **planes**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AluviaClient                             │
├─────────────────────────────┬───────────────────────────────────┤
│       Control Plane         │          Data Plane               │
│       (ConfigManager)       │          (ProxyServer)            │
├─────────────────────────────┼───────────────────────────────────┤
│ • Fetches/creates config    │ • Local HTTP proxy (proxy-chain)  │
│ • Polls for updates (ETag)  │ • Per-request routing decisions   │
│ • PATCH updates (rules,     │ • Uses rules engine to decide:    │
│   session, geo)             │   direct vs gateway               │
└─────────────────────────────┴───────────────────────────────────┘
```

### Control Plane (ConfigManager)

- Communicates with the Aluvia REST API (`/account/connections/...`)
- Fetches proxy credentials and routing rules
- Polls for configuration updates
- Pushes updates (rules, session ID, geo)

### Data Plane (ProxyServer)

- Runs a local HTTP proxy on `127.0.0.1`
- For each request, uses the **rules engine** to decide whether to route direct or via Aluvia.
- Because the proxy reads the latest config per-request, rule updates take effect immediately

---

## Using Aluvia client

### 1. Create a client

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: 123, // Optional: reuse an existing connection
  startPlaywright: true, // Optional: auto-launch Chromium browser
});
```

For all options, see the [Client Technical Guide](docs/client-technical-guide.md#constructor-options).

### 2. Start the client and get a connection

```ts
const connection = await client.start();
```

This starts the local proxy and returns a connection object you'll use with your tools.
[Understanding the connection object](https://docs.aluvia.io/fundamentals/connections)

### 3. Use the connection with your tools

Pass the connection to your automation tool using the appropriate adapter:

```ts
const browser = await chromium.launch({ proxy: connection.asPlaywright() });
```

### 4. Update routing as necessary

While your agent is running, you can update routing rules, rotate IPs, or change geo targeting—no restart needed:

```ts
await client.updateRules(["blocked-site.com"]); // Add hostname to proxy rules
await client.updateSessionId("newsession"); // Rotate to a new IP
await client.updateTargetGeo("us_ca"); // Target California IPs
```

### 5. Clean up when done

```ts
await connection.close(); // Stops proxy, polling, and releases resources
```

---

## Routing rules

The Aluvia Client starts a local proxy server that routes each request based on hostname rules that you (or our agent) set. **Rules can be updated at runtime without restarting the agent.**

Traffic can be sent either:

- direct (using the agent's datacenter/cloud IP) or,
- through Aluvia's mobile proxy IPs,

### Benefits

- Selectively routing traffic to mobile proxies reduces proxy costs and connection latency.
- Rules can be updated during runtime, allowing agents to work around website blocks on the fly.

### Example rules

```ts
await client.updateRules(["*"]); // Proxy all traffic
await client.updateRules(["target-site.com", "*.google.com"]); // Proxy specific hosts
await client.updateRules(["*", "-api.stripe.com"]); // Proxy all except specified
await client.updateRules([]); // Route all traffic direct
```

### Supported routing rule patterns:

| Pattern         | Matches                               |
| --------------- | ------------------------------------- |
| `*`             | All hostnames                         |
| `example.com`   | Exact match                           |
| `*.example.com` | Subdomains of example.com             |
| `google.*`      | google.com, google.co.uk, and similar |
| `-example.com`  | Exclude from proxying                 |

---

## Dynamic unblocking

Most proxy solutions require you to decide upfront which sites to proxy. If a site blocks you later, you're stuck—restart your workers, redeploy your fleet, or lose the workflow.

**With Aluvia, your agent can unblock itself.** The SDK includes automatic page load detection that identifies blocks, CAPTCHAs, and WAF challenges using a weighted scoring system across multiple signals (HTTP status codes, WAF headers, challenge selectors, page content, redirect chains, and more). The `onDetection` callback fires on every page analysis with the detection score, tier, and signals — giving your agent full visibility into what's happening.

### Automatic detection (recommended)

Enable page load detection to let the SDK handle blocks automatically:

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    onDetection: (result, page) => {
      console.log(`${result.tier} on ${result.hostname} (score: ${result.score})`);
    },
  },
});

const connection = await client.start();
const page = await connection.browserContext.newPage();
await page.goto("https://example.com"); // Auto-reloads through Aluvia if blocked
```

### Detection-only mode

Set `autoReload: false` to receive detection results without automatic rule updates or page reloads. This lets your agent inspect scores and decide how to respond:

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    autoReload: false,
    onDetection: (result, page) => {
      console.log(`${result.tier} on ${result.hostname} (score: ${result.score})`);
      if (result.tier === "blocked") {
        // Agent decides what to do
      }
    },
  },
});
```

Detection runs in two passes: a fast pass at `domcontentloaded` for high-confidence HTTP signals, and a full pass after `networkidle` that checks page content, challenge selectors, and redirect chains. The SDK also detects SPA navigations and persistent blocks (hostname-level escalation prevents infinite retry loops).

### Manual detection

You can also check responses manually and update rules on the fly:

```ts
const response = await page.goto(url);

if (response?.status() === 403) {
  // Blocked! Add this hostname to proxy rules and retry
  await client.updateRules([...currentRules, new URL(url).hostname]);
  await page.goto(url); // This request goes through Aluvia
}
```

Your agent learns which sites need proxying as it runs. Sites that don't block you stay direct (faster, cheaper). Sites that do block you get routed through mobile IPs automatically.

---

## Tool integration adapters

Every tool has its own way of configuring proxies—Playwright wants { server, username, password }, Puppeteer wants CLI args, Axios wants agents, and Node's native fetch doesn't support proxies at all. The SDK handles all of this for you:

| Tool         | Method                       | Returns                                                     |
| ------------ | ---------------------------- | ----------------------------------------------------------- |
| Playwright   | `connection.asPlaywright()`  | `{ server, username?, password? }`                          |
| Playwright   | `connection.browser`         | Auto-launched Chromium browser (if `startPlaywright: true`) |
| Puppeteer    | `connection.asPuppeteer()`   | `['--proxy-server=...']`                                    |
| Selenium     | `connection.asSelenium()`    | `'--proxy-server=...'`                                      |
| Axios        | `connection.asAxiosConfig()` | `{ proxy: false, httpAgent, httpsAgent }`                   |
| got          | `connection.asGotOptions()`  | `{ agent: { http, https } }`                                |
| fetch        | `connection.asUndiciFetch()` | Proxy-enabled `fetch` function                              |
| Node.js http | `connection.asNodeAgents()`  | `{ http: Agent, https: Agent }`                             |

**Playwright auto-launch:** Set `startPlaywright: true` in the client options to automatically launch a Chromium browser that's already configured with the Aluvia proxy. The browser is available via `connection.browser` and is automatically cleaned up when you call `connection.close()`.

For more details regarding integration adapters, see the [Client Technical Guide](docs/client-technical-guide.md#tool-adapters).

---

## Aluvia API

`AluviaApi` is a typed wrapper for the Aluvia REST API. Use it to manage connections, query account info, or build custom tooling—without starting a proxy.

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

### What you can do

| Endpoint                             | Description                             |
| ------------------------------------ | --------------------------------------- |
| `api.account.get()`                  | Get account info (balance, usage)       |
| `api.account.connections.list()`     | List all connections                    |
| `api.account.connections.create()`   | Create a new connection                 |
| `api.account.connections.get(id)`    | Get connection details                  |
| `api.account.connections.patch(id)`  | Update connection (rules, geo, session) |
| `api.account.connections.delete(id)` | Delete a connection                     |
| `api.geos.list()`                    | List available geo-targeting options    |

### Example

```ts
import { AluviaApi } from "@aluvia/sdk";

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

// Check account balance
const account = await api.account.get();
console.log("Balance:", account.balance_gb, "GB");

// Create a connection for a new agent
const connection = await api.account.connections.create({
  description: "pricing-scraper",
  rules: ["competitor-site.com"],
  target_geo: "us_ca",
});
console.log("Created:", connection.connection_id);

// List available geos
const geos = await api.geos.list();
console.log(
  "Geos:",
  geos.map((g) => g.code),
);
```

**Tip:** `AluviaApi` is also available as `client.api` when using `AluviaClient`.

For the complete API reference, see [API Technical Guide](docs/api-technical-guide.md).

---

## License

MIT — see [LICENSE](./LICENSE)
