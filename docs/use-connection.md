---
title: Use Connection
description: Use a connection with the Aluvia client
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Use a connection

`AluviaClient` leverages the Aluvia API to create a connection (or use an existing connection) and configure automation tools to route traffic through Aluvia.

Of course, you can also use the flexible Aluvia API for custom integration workflows. The Aluvia SDK offers language-specific API wrappers.

## Get your account API key

Get your account API key from the Aluvia dashboard:

1. Log into the Aluvia dashboard.
2. Go to the API page.
3. Copy your API key.

## Start the Aluvia client

To start the client:

- Use your **account API key** (required) as `apiKey`.
- If you want to reuse an existing connection, include its **connection ID** as `connectionId` (optional).
- If you omit `connectionId`, the client automatically creates a new connection during `start()`.
- Always call `await connection.close()` when you’re done. This stops the local proxy (default mode) and polling timers so Node.js can shut down cleanly.

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!, // required
  connectionId: process.env.ALUVIA_CONNECTION_ID, // optional
});

const connection = await client.start();

// Integration and automation code...

await connection.close(); // recommended cleanup
```

### Client configuration options

```ts
new AluviaClient({
  apiKey: string, // required
  connectionId?: string, // optional
  localProxy?: boolean, // optional, default true
  strict?: boolean, // optional, default true (fail fast if config can't be loaded/created)
  apiBaseUrl?: string, // optional, default https://api.aluvia.io/v1
  pollIntervalMs?: number, // optional, default 5000
  timeoutMs?: number, // optional, default 30000 (API wrapper HTTP only)
  gatewayProtocol?: 'http' | 'https', // optional, default http
  gatewayPort?: number, // optional, default 8080 or 8443 depending on protocol
  localPort?: number, // optional; only relevant when localProxy true
  logLevel?: 'silent' | 'info' | 'debug', // optional, default info
});
```

## Integrate with tools

After `const connection = await client.start()`, the SDK returns a `connection` object with **integration helpers**. These helpers return proxy settings in the format each tool expects:

- `asPlaywright()` → `{ server, username?, password? }`
- `asPuppeteer()` → `['--proxy-server=<server>']` (no embedded creds)
- `asSelenium()` → `'--proxy-server=<server>'` (no embedded creds)
- `asNodeAgents()` → `{ http, https }`
- `asAxiosConfig()` → `{ proxy: false, httpAgent, httpsAgent }`
- `asGotOptions()` → `{ agent: { http, https } }`
- `asUndiciDispatcher()` → `undici.Dispatcher` (proxy-aware dispatcher)
- `asUndiciFetch()` → `fetch` function powered by `undici` with per-request `dispatcher`

<Tabs groupId="node-tools">
<TabItem value="playwright" label="Playwright" default>

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

</TabItem>
<TabItem value="puppeteer" label="Puppeteer">

```ts
import puppeteer from 'puppeteer';
import { AluviaClient } from '@aluvia/sdk';

// Tip: For Puppeteer, `localProxy: true` (default) is recommended so you don't have to implement proxy auth yourself.
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID, // optional
  localProxy: true, // true is default
});

const connection = await client.start();

const browser = await puppeteer.launch({
  headless: true,
  args: connection.asPuppeteer(),
});

try {
  const page = await browser.newPage();
  await page.goto('https://ipconfig.io/json', { waitUntil: 'domcontentloaded' });
} finally {
  await browser.close();
  await connection.close();
}
```

</TabItem>
<TabItem value="selenium" label="Selenium">

```ts
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { AluviaClient } from '@aluvia/sdk';

// Tip: For Selenium, `localProxy: true` (default) is recommended so you don't have to implement proxy auth yourself.
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID, // optional
  localProxy: true, // true is default
});

const connection = await client.start();

const options = new chrome.Options();
options.addArguments(connection.asSelenium());

const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

try {
  await driver.get('https://ipconfig.io/json');
} finally {
  await driver.quit();
  await connection.close();
}
```

</TabItem>
<TabItem value="fetch" label="Fetch">

```ts
import { AluviaClient } from '@aluvia/sdk';

// Node's built-in fetch does not accept Node proxy agents. Use the undici-powered fetch adapter.
const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

const fetch = connection.asUndiciFetch();

try {
  const res = await fetch('https://ipconfig.io/json');
  console.log(await res.json());
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="axios" label="Axios">

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

try {
  const res = await axios.get('https://ipconfig.io/json', connection.asAxiosConfig());
  console.log(res.data);
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="got" label="Got">

```ts
import got from 'got';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

try {
  const data = await got('https://ipconfig.io/json', connection.asGotOptions()).json();
  console.log(data);
} finally {
  await connection.close();
}
```

</TabItem>
</Tabs>

 
