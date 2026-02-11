---
title: Playwright
sidebar_position: 1
description: Use Aluvia with Playwright
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Integrate with Playwright

Aluvia integrates with Playwright by **configuring Playwright’s proxy settings**. You pass a proxy object to Playwright (for example, `chromium.launch({ proxy: ... })`), and Playwright sends browser traffic through that proxy.



## Recommended (Node.js): use `AluviaClient` and `connection.asPlaywright()`

By default, `AluviaClient` starts a **local proxy** on `127.0.0.1` and returns Playwright proxy settings pointing at that local proxy. This is the safest/cleanest integration because:

- **No proxy credentials** are embedded in your Playwright config (the SDK holds gateway credentials internally).
- The SDK can do **per-hostname routing** (direct vs Aluvia) when running the local proxy.

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID, // optional
});

const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

try {
  const page = await browser.newPage();
  await page.goto('https://ipconfig.io/json');
} finally {
  await browser.close();
  await connection.close();
}
```

## Auto-launch with block detection

Use `startPlaywright: true` with `blockDetection` to let the SDK launch a Chromium browser and automatically detect and recover from blocks:

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  startPlaywright: true,
  blockDetection: {
    enabled: true,
    onDetection: (result, page) => {
      console.log(`${result.tier} on ${result.hostname} (score: ${result.score})`);
    },
  },
});

const connection = await client.start();

try {
  const page = await connection.browserContext.newPage();
  // If the page is blocked, the SDK automatically adds the hostname
  // to routing rules and reloads through Aluvia's mobile IPs
  await page.goto('https://example.com');
} finally {
  await connection.close();
}
```

By default, `autoUnblock` is `false`, so detection scores are reported without automatic rule updates or reloads — useful when your agent needs to decide how to handle blocks:

```ts
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  startPlaywright: true,
  blockDetection: {
    enabled: true,
    onDetection: (result, page) => {
      // Fires on every page load, including clear results
      console.log(`${result.tier} on ${result.hostname} (score: ${result.score})`);
    },
  },
});
```

The detection system uses a weighted scoring engine with two-pass analysis (fast pass at `domcontentloaded`, full pass after `networkidle`) and handles SPA navigations. See the [Client Technical Guide](../client-technical-guide.md#block-detection) for full configuration options and signal details.

## Node.js: use the SDK API wrapper to fetch gateway proxy credentials

If you don’t want to start the SDK’s local proxy process, you can call the Aluvia API directly via the SDK’s API wrapper (`AluviaApi`) to fetch the **proxy username/password** for an account connection, then configure Playwright with those credentials.

Important notes:

- These calls use **`/account/...`** endpoints, so you must use an **account API token**.
- The SDK’s gateway host is `gateway.aluvia.io`. You choose protocol/port (commonly `http:8080` or `https:8443`).
- Treat proxy credentials as secrets. Don’t log them.

```ts
import { chromium } from 'playwright';
import { AluviaApi } from '@aluvia/sdk';

const apiKey = process.env.ALUVIA_API_KEY!;
const connectionId = process.env.ALUVIA_CONNECTION_ID!;

const api = new AluviaApi({ apiKey });

const accountConn = await api.account.connections.get(connectionId);
if (!accountConn) {
  throw new Error('Connection config was not returned (HTTP 304 Not Modified)');
}

const username = accountConn.proxy_username;
const password = accountConn.proxy_password;
if (!username || !password) {
  throw new Error('API response missing proxy credentials (proxy_username/proxy_password)');
}

const server = 'http://gateway.aluvia.io:8080';

const browser = await chromium.launch({
  proxy: { server, username, password },
});

try {
  const page = await browser.newPage();
  await page.goto('https://ipconfig.io/json');
} finally {
  await browser.close();
}
```

## Raw HTTP examples (JavaScript / Python)

These examples show how to:

- send an HTTP request to `GET /v1/account/connections/:id`
- extract `proxy_username` / `proxy_password`
- configure Playwright with the resulting proxy settings

<Tabs groupId="playwright-proxy-source">
<TabItem value="js" label="JavaScript (Node.js)" default>

```js
import { chromium } from 'playwright';

const apiKey = process.env.ALUVIA_API_KEY;
const connectionId = process.env.ALUVIA_CONNECTION_ID;

if (!apiKey || !connectionId) {
  throw new Error('Missing ALUVIA_API_KEY or ALUVIA_CONNECTION_ID');
}

const res = await fetch(`https://api.aluvia.io/v1/account/connections/${connectionId}`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  },
});

if (!res.ok) {
  throw new Error(`Aluvia API request failed (HTTP ${res.status})`);
}

const json = await res.json();
const data = json?.data ?? null;
if (!data) {
  throw new Error('Aluvia API response missing data envelope');
}

const username = data.proxy_username;
const password = data.proxy_password;
if (!username || !password) {
  throw new Error('Aluvia API response missing proxy_username/proxy_password');
}

const server = 'http://gateway.aluvia.io:8080';

const browser = await chromium.launch({
  proxy: { server, username, password },
});

try {
  const page = await browser.newPage();
  await page.goto('https://ipconfig.io/json');
} finally {
  await browser.close();
}
```

</TabItem>
<TabItem value="py" label="Python">

```python
import os
import requests
from playwright.async_api import async_playwright

api_key = os.environ.get("ALUVIA_API_KEY")
connection_id = os.environ.get("ALUVIA_CONNECTION_ID")

if not api_key or not connection_id:
    raise RuntimeError("Missing ALUVIA_API_KEY or ALUVIA_CONNECTION_ID")

res = requests.get(
    f"https://api.aluvia.io/v1/account/connections/{connection_id}",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    },
    timeout=30,
)
res.raise_for_status()

payload = res.json()
data = payload.get("data")
if not data:
    raise RuntimeError("Aluvia API response missing data envelope")

username = data.get("proxy_username")
password = data.get("proxy_password")
if not username or not password:
    raise RuntimeError("Aluvia API response missing proxy_username/proxy_password")

server = "http://gateway.aluvia.io:8080"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            proxy={"server": server, "username": username, "password": password}
        )
        try:
            page = await browser.new_page()
            await page.goto("https://ipconfig.io/json")
        finally:
            await browser.close()

import asyncio
asyncio.run(main())
```

</TabItem>
</Tabs>

