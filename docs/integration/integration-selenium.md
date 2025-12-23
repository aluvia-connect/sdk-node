---
title: Selenium
sidebar_position: 3
description: Use Aluvia with Selenium
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Integrate with Selenium

Aluvia integrates with Selenium by **configuring the browser’s proxy settings** (via Selenium Options / capabilities). You point the browser at a proxy, and the browser sends traffic through that proxy.

## Recommended (Node.js): use `AluviaClient` and `connection.asSelenium()`

By default, `AluviaClient` starts a **local proxy** on `127.0.0.1`. You then configure Selenium to use that local proxy. This is the safest/cleanest integration because:

- **No proxy credentials** are embedded in your test config (the SDK holds gateway credentials internally).
- The SDK can do **per-hostname routing** (direct vs Aluvia) when running the local proxy.

```ts
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID, // optional
});

const connection = await client.start();

const options = new chrome.Options().addArguments(
  connection.asSelenium(),
);

const driver = await new Builder()
  .forBrowser('chrome')
  .setChromeOptions(options)
  .build();

try {
  await driver.get('https://ipconfig.io/json');
} finally {
  await driver.quit();
  await connection.close();
}
```

## Node.js: use the SDK API wrapper to fetch gateway proxy credentials

If you don’t want to start the SDK’s local proxy process, you can call the Aluvia API directly via the SDK’s API wrapper (`AluviaApi`) to fetch the **proxy username/password** for an account connection, then configure Selenium with those credentials.

Important notes:

- These calls use **`/account/...`** endpoints, so you must use an **account API token**.
- The SDK’s gateway host is `gateway.aluvia.io`. You choose protocol/port (commonly `http:8080` or `https:8443`).
- Treat proxy credentials as secrets. Don’t log them.

```ts
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
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

// Many Selenium setups require help (e.g. an auth-capable proxy helper/extension)
// to use username/password with a browser proxy. The snippet below encodes creds
// into the proxy URL for environments that support it.
const proxyUrl = new URL(server);
proxyUrl.username = username;
proxyUrl.password = password;

const options = new chrome.Options().addArguments(
  `--proxy-server=${proxyUrl.toString()}`,
);

const driver = await new Builder()
  .forBrowser('chrome')
  .setChromeOptions(options)
  .build();

try {
  await driver.get('https://ipconfig.io/json');
} finally {
  await driver.quit();
}
```

## Raw HTTP examples (JavaScript / Python)

These examples show how to:

- send an HTTP request to `GET /v1/account/connections/:id`
- extract `proxy_username` / `proxy_password`
- configure Selenium with the resulting proxy settings

<Tabs groupId="selenium-proxy-source">
<TabItem value="js" label="JavaScript (Node.js)" default>

```js
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

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

const proxyUrl = new URL(server);
proxyUrl.username = username;
proxyUrl.password = password;

const options = new chrome.Options().addArguments(
  `--proxy-server=${proxyUrl.toString()}`,
);

const driver = await new Builder()
  .forBrowser('chrome')
  .setChromeOptions(options)
  .build();

try {
  await driver.get('https://ipconfig.io/json');
} finally {
  await driver.quit();
}
```

</TabItem>
<TabItem value="py" label="Python">

```python
import os
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

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

# Some environments accept credentials embedded in the proxy URL.
proxy_url = server.replace("http://", f"http://{username}:{password}@", 1)

opts = Options()
opts.add_argument(f"--proxy-server={proxy_url}")

driver = webdriver.Chrome(options=opts)
try:
    driver.get("https://ipconfig.io/json")
finally:
    driver.quit()
```

</TabItem>
</Tabs>

