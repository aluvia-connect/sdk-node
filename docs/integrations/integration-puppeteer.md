---
title: Puppeteer
sidebar_position: 2
description: Use Aluvia with Puppeteer
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Integrate with Puppeteer

Aluvia integrates with Puppeteer by **configuring Chromium’s proxy settings**. You pass a proxy server to Puppeteer via Chromium args (for example, `puppeteer.launch({ args: ['--proxy-server=...'] })`), and browser traffic is routed through that proxy.

## Recommended (Node.js): use `AluviaClient` and `connection.asPuppeteer()`

By default, `AluviaClient` starts a **local proxy** on `127.0.0.1`. This is the safest/cleanest integration because:

- **No proxy credentials** are embedded in your Puppeteer config (the SDK holds gateway credentials internally).
- The SDK can do **per-hostname routing** (direct vs Aluvia) when running the local proxy.

```ts
import puppeteer from 'puppeteer';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID, // optional
});

const connection = await client.start();

const browser = await puppeteer.launch({
  args: connection.asPuppeteer(),
});

try {
  const page = await browser.newPage();
  await page.goto('https://ipconfig.io/json');
} finally {
  await browser.close();
  await connection.close();
}
```

## Node.js: use the SDK API wrapper to fetch gateway proxy credentials

If you don’t want to start the SDK’s local proxy process, you can call the Aluvia API directly via the SDK’s API wrapper (`AluviaApi`) to fetch the **proxy username/password** for an account connection, then configure Puppeteer to use the gateway.

Important notes:

- These calls use **`/account/...`** endpoints, so you must use an **account API token**.
- The SDK’s gateway host is `gateway.aluvia.io`. You choose protocol/port (commonly `http:8080` or `https:8443`).
- Treat proxy credentials as secrets. Don’t log them.

```ts
import puppeteer from 'puppeteer';
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

// Gateway proxy server (choose protocol/port)
const server = 'http://gateway.aluvia.io:8080';

const browser = await puppeteer.launch({
  args: [`--proxy-server=${server}`],
});

try {
  const page = await browser.newPage();

  // Puppeteer sets proxy credentials per page
  await page.authenticate({ username, password });

  await page.goto('https://ipconfig.io/json');
} finally {
  await browser.close();
}
```

## Raw HTTP examples (JavaScript / Python)

These examples show how to:

- send an HTTP request to `GET /v1/account/connections/:id`
- extract `proxy_username` / `proxy_password`
- configure Puppeteer with the resulting proxy settings

<Tabs groupId="puppeteer-proxy-source">
<TabItem value="js" label="JavaScript (Node.js)" default>

```js
import puppeteer from 'puppeteer';

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

const browser = await puppeteer.launch({
  args: [`--proxy-server=${server}`],
});

try {
  const page = await browser.newPage();
  await page.authenticate({ username, password });
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
import asyncio
from pyppeteer import launch  # pip install pyppeteer

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
    browser = await launch(args=[f"--proxy-server={server}"])
    try:
        page = await browser.newPage()
        await page.authenticate({"username": username, "password": password})
        await page.goto("https://ipconfig.io/json")
    finally:
        await browser.close()

asyncio.get_event_loop().run_until_complete(main())
```

</TabItem>
</Tabs>

