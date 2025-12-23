---
title: Got
sidebar_position: 6
description: Use Aluvia with Got
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Integrate with Got

Aluvia integrates with Got by **sending HTTP requests through a proxy**.

## Recommended (Node.js): use `AluviaClient` (local proxy) + Got

By default, `AluviaClient` starts a **local proxy** on `127.0.0.1`. This is the safest/cleanest integration because:

- **No gateway proxy credentials** are embedded in your app (the SDK holds them internally).
- The SDK can do **per-hostname routing** (direct vs Aluvia) when running the local proxy.

> This example assumes Got v12+ (Undici-based). If you are on an older Got version, proxy configuration differs.

```ts
import got from 'got';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID, // optional
});

const connection = await client.start();

try {
  const data = await got('https://ipconfig.io/json', {
    agent: connection.asNodeAgents(),
  }).json();

  console.log(data);
} finally {
  await connection.close();
}
```

## Node.js: fetch gateway proxy credentials via `AluviaApi`, then proxy Got via gateway

If you don’t want to start the SDK’s local proxy process, you can call the Aluvia API directly via the SDK’s API wrapper (`AluviaApi`) to fetch the **proxy username/password** for an account connection, then send requests through the Aluvia gateway proxy with those credentials.

Important notes:

- These calls use **`/account/...`** endpoints, so you must use an **account API token**.
- The SDK’s gateway host is `gateway.aluvia.io`. You choose protocol/port (commonly `http:8080` or `https:8443`).
- Treat proxy credentials as secrets. Don’t log them.

```ts
import got from 'got';
import { ProxyAgent } from 'undici';
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
const gatewayProxyServer = 'http://gateway.aluvia.io:8080';

// For basic auth over an HTTP proxy, embed credentials in the proxy URL.
const proxyUrl = new URL(gatewayProxyServer);
proxyUrl.username = username;
proxyUrl.password = password;

const proxyAgent = new ProxyAgent(proxyUrl.toString());

const data = await got('https://ipconfig.io/json', {
  agent: { https: proxyAgent, http: proxyAgent },
}).json();

console.log(data);
```

## Raw HTTP examples (JavaScript / Python)

These examples show how to:

- send an HTTP request to `GET /v1/account/connections/:id`
- extract `proxy_username` / `proxy_password`
- send an HTTP request through Aluvia using those proxy credentials (via Got)

<Tabs groupId="got-proxy-source">
<TabItem value="js" label="JavaScript (Node.js)" default>

```js
import got from 'got';
import { ProxyAgent } from 'undici';

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

const gatewayProxyServer = 'http://gateway.aluvia.io:8080';
const proxyUrl = new URL(gatewayProxyServer);
proxyUrl.username = username;
proxyUrl.password = password;

const proxyAgent = new ProxyAgent(proxyUrl.toString());

const ip = await got('https://ipconfig.io/json', {
  agent: { https: proxyAgent, http: proxyAgent },
}).json();

console.log(ip);
```

</TabItem>
<TabItem value="py" label="Python">

```python
import os
import requests

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

proxies = {
    "http": f"http://{username}:{password}@gateway.aluvia.io:8080",
    "https": f"http://{username}:{password}@gateway.aluvia.io:8080",
}

ip_res = requests.get("https://ipconfig.io/json", proxies=proxies, timeout=30)
ip_res.raise_for_status()

print(ip_res.json())
```

</TabItem>
</Tabs>
````

</file>
