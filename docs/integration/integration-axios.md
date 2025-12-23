---
title: Axios
sidebar_position: 5
description: Use Aluvia with Axios
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Integrate with Axios

Aluvia integrates with Axios by **sending HTTP requests through a proxy**.

## Recommended (Node.js): use `AluviaClient` (local proxy) + Axios

By default, `AluviaClient` starts a **local proxy** on `127.0.0.1`. This is the safest/cleanest integration because:

- **No gateway proxy credentials** are embedded in your app (the SDK holds them internally).
- The SDK can do **per-hostname routing** (direct vs Aluvia) when running the local proxy.

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID, // optional
});

const connection = await client.start();

try {
  const res = await axios.get('https://ipconfig.io/json', connection.asAxiosConfig());

  console.log(res.data);
} finally {
  await connection.close();
}
```

## Node.js: fetch gateway proxy credentials via `AluviaApi`, then configure Axios

If you don’t want to start the SDK’s local proxy process, you can call the Aluvia API directly via the SDK’s API wrapper (`AluviaApi`) to fetch the **proxy username/password** for an account connection, then configure Axios to use the Aluvia gateway proxy with those credentials.

Important notes:

- These calls use **`/account/...`** endpoints, so you must use an **account API token**.
- The SDK’s gateway host is `gateway.aluvia.io`. You choose protocol/port (commonly `http:8080` or `https:8443`).
- Treat proxy credentials as secrets. Don’t log them.

```ts
import axios from 'axios';
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
const proxyUrl = new URL(server);

const res = await axios.get('https://ipconfig.io/json', {
  proxy: {
    protocol: proxyUrl.protocol.replace(':', ''),
    host: proxyUrl.hostname,
    port: Number(proxyUrl.port),
    auth: { username, password },
  },
});

console.log(res.data);
```

## Node.js: proxy via `http(s)-proxy-agent` (robust alternative)

Some environments require using explicit agents instead of Axios’ `proxy` option.

```ts
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

const username = process.env.ALUVIA_PROXY_USERNAME!;
const password = process.env.ALUVIA_PROXY_PASSWORD!;

// Common gateway option:
const proxyOrigin = 'http://gateway.aluvia.io:8080';

const proxyUrl = new URL(proxyOrigin);
proxyUrl.username = username;
proxyUrl.password = password;

const httpAgent = new HttpProxyAgent(proxyUrl);
const httpsAgent = new HttpsProxyAgent(proxyUrl);

const res = await axios.get('https://ipconfig.io/json', {
  proxy: false, // important: disable Axios proxy handling when using custom agents
  httpAgent,
  httpsAgent,
});

console.log(res.data);
```

## Raw HTTP examples (JavaScript / Python)

These examples show how to:

- send an HTTP request to `GET /v1/account/connections/:id`
- extract `proxy_username` / `proxy_password`
- configure Axios with the resulting proxy settings

<Tabs groupId="axios-proxy-source">
<TabItem value="js" label="JavaScript (Node.js)" default>

```js
import axios from 'axios';

const apiKey = process.env.ALUVIA_API_KEY;
const connectionId = process.env.ALUVIA_CONNECTION_ID;

if (!apiKey || !connectionId) {
  throw new Error('Missing ALUVIA_API_KEY or ALUVIA_CONNECTION_ID');
}

const apiRes = await fetch(`https://api.aluvia.io/v1/account/connections/${connectionId}`, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  },
});

if (!apiRes.ok) {
  throw new Error(`Aluvia API request failed (HTTP ${apiRes.status})`);
}

const json = await apiRes.json();
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
const proxyUrl = new URL(server);

const res = await axios.get('https://ipconfig.io/json', {
  proxy: {
    protocol: proxyUrl.protocol.replace(':', ''),
    host: proxyUrl.hostname,
    port: Number(proxyUrl.port),
    auth: { username, password },
  },
});

console.log(res.data);
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

