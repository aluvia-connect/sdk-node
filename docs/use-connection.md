---
title: Use Connection
description: Use a connection with the Aluiva client
sidebar_position: 1

---


# Use a connection with the Aluiva client


## Start the Aluvia client

Include your Aluvia API key. If you would like to use an existing connection, include the `connection ID`. If you do not include a connection ID, the client will automatically create a new connection.

Remember to use `await connection.close()` to close the connection and stop client processies.

```ts
import { chromium } from 'playwright-core';
import { AluviaClient } from '@aluvia/sdk';

//Start client with optional connection ID
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!, //required
  connection_id: process.env.ALUVIA_CONNECTION_ID!, //optional
});
const connection = await client.start();

//Integration and automation code...

//Close connection and stop cient
await connection.close();

```

## Client configuration options

```ts
new AluviaClient({
  apiKey: string,                 // required
  connection_id?: string,         // optional
  local_proxy?: boolean,        // optional, default true
  strict?: boolean,              // optional, default true (fail fast if config can't be loaded/created)
  apiBaseUrl?: string,            // optional, default https://api.aluvia.io/v1
  pollIntervalMs?: number,        // optional, default 5000
  timeoutMs?: number,             // optional, default 30000 (API wrapper HTTP only)
  gatewayProtocol?: 'http'|'https', // optional, default http
  gatewayPort?: number,           // optional, default 8080 or 8443 depending on protocol
  localPort?: number,             // optional; only relevant when local_proxy true
  logLevel?: 'silent'|'info'|'debug', // optional, default info
});
```


## Integrating with tools

The Aluvia client provides **integration helpers** on the connection object to faciliate easy integration. Helpers are available for the following tools:

- `asPlaywright()` → `{ server, username?, password? }`
- `asPuppeteer()` → `['--proxy-server=<server>']` (no embedded creds)
- `asSelenium()` → `'--proxy-server=<server>'` (no embedded creds)
- `asNodeAgents()` → `{ http, https }` 
- `asAxiosConfig()` → `{ proxy: false, httpAgent, httpsAgent }`
- `asGotOptions()` → `{ agent: { http, https } }`
- `asUndiciDispatcher()` → `undici.Dispatcher` (proxy-aware dispatcher)
- `asUndiciFetch()` → `fetch` function powered by `undici` with per-request `dispatcher`




import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs groupId="node-tools">
<TabItem value="playwright" label="Playwright" default>

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID, // optional
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

// Tip: for Puppeteer/Chromium, `local_proxy: true` (default) is recommended
// so you don't have to implement proxy auth yourself.
const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
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

// Tip: for Selenium/Chromium, `local_proxy: true` (default) is recommended
// so you don't have to implement proxy auth yourself.
const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

const options = new chrome.Options();
options.addArguments(connection.asSelenium()); // => "--proxy-server=<server>"

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