# Aluvia Node.js SDK

[![npm](https://img.shields.io/npm/v/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![downloads](https://img.shields.io/npm/dm/@aluvia/sdk.svg)](https://www.npmjs.com/package/@aluvia/sdk)
[![license](https://img.shields.io/npm/l/@aluvia/sdk.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@aluvia/sdk.svg)](./package.json)

[Aluvia](https://aluvia.io) provides reliable, scalable connectivity-as-a-service for AI agents. This Node.js SDK allows developers to easily integrate and configure Aluvia connectivity into their agent workflows.

There are two key components:
1. Aluvia client - lets agents route traffic through Aluvia's trusted US mobile IP addresses instead of their own cloud/datacenter IPs. Reduces website blocks and allows for reliable agent workflows at scale.
2. API wrapper - a JavaScript wrapper for the Aluvia API

## Aluvia client

The Aluvia client consists of a control plane to configure connection settings, and a local proxy server for routing traffic. 

Simply run the client on your agent's machine/server/container, and point your relevant tool (Playwright, Puppeteer, Axios, etc.) to the local proxy address (`127.0.0.1`). The client routes traffic to Aluvia's mobile IPs based on custom routing rules that you (or our agent) set. Rules can be updated during runtime, allowing agents to work around website blocks on the fly.

Please see the [Aluvia client documentation ](https://docs.aluiva.io) for more details.

### Benefits
#### Improves agent reliability
* **Problem:** agents run in the cloud, yet websites often treat datacenter traffic as higher-risk, resulting in challenges, rate limits (429), blocks (403), and broken workflows.
- **Solution:** the client routes requests through Aluvia’s premium mobile IP addresses when needed, dramatically reducing blocks and increasing end-to-end workflow completion.
#### Reduces the cost of using proxies
- **Problem:** connecting to websites through mobile proxies is expensive and adds latency.
- **Solution:** the SDK supports custom hostname routing rules. Developers, or the agents themselves, can specify specific hostnames to proxy. This minimizes cost while preserving reliability.
#### Unblock agent workflows without restarts
- **Problem:** adjusting an agent's proxy settings usually requires restarting long-running workers or redeploying a fleet.
- **Solution:** the SDK's routing rules can be updated on the fly, allowing agents to dynamically respond to website blocks without restarts.
#### Simplify integration
- **Problem:** to proxy an agent's traffic, developers must learn how to configure a myriad of tools such as Playwright, Puppeteer, Selenium, Axios, etc.
- **Solution:** one integration surface across multiple tools.

### Use case example

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

### Quick start guides
* [Understand how Aluvia connections work](https://docs.aluvia.io/fundamentals/connections)
* [How to create a connection](https://docs.aluvia.io/connect/create-connection)
* [How to use a connection](https://docs.aluvia.io/connect/use-connection)
* [How to manage a connection](https://docs.aluvia.io/connect/manage-connection)


## Aluvia API

The SDK provides convenient access to the Aluvia REST API from server-side TypeScript or JavaScript. The REST API documentation can be found in the [API reference docs](https://docs.aluvia.io/api/api-reference/aluvia-api-v-1).


