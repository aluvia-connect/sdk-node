Review the following files:
@ai_agent_setup/projectdoc.md  
@ai_agent_setup/dev-explainer.md 
@README.md 

Review entire code base for the Aluvia SDK and develop a deep and complete understanding of how the Aluvia SDK works:
@\home\unbuntu\aluvia-client\ 

Once you have thought deeply, reflected on your knowledge, and truly understand how this repo works, you need to remember that you are an expert technical documentation writer. You have extensive experience writing clear, useful, and concise documentation for developers. You consistently write docs that quickly and effectively impart relevant information. The documentation you write is truly a joy to read.

When you write, follow the best practices outlined here:
https://www.mintlify.com/guides/introduction

Adhere the Google developer documentation style guide:
https://developers.google.com/style

When writing example code, keep it minimal, efficient, and clean.

Dutifully fix any spelling or grammar errors that you find.

The document @docs/use-connection.md  should have the following parts. Please review carefully and update the doc to align it with the outline below:

# Use a connection with the Aluvia client
Brief introduction sentence below the title. This sentence should sum up the purpose of this page.

## Get your account API key
Brief instructions for obtaining an API key from the Aluvia dashboard:
1. Log into the Aluvia dashboard
2. Go to API page
3. Copy API key

## Start the Aluvia client
Intro sentences that explain:
1. User needs to use their API Key
2. If user would like to use an existing connection, they need to include the `connection ID`
3. If no connection ID is included, the client will automatically create a new connection
4. User should use `await connection.close()` to close the connection and stop client processes. This is important so that Node.js can properly shut down when necessary.

### Client configuration options
A code block that shows all available AluviaClient() configuration options. You can find this in src/client/AluviaClient.ts and it should look something like this:

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

## Integrate with tools
explain what integration helpers are
a code block with multiple tabs. the example code shows how to use integration helpers with various tools. should look something like:

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

// Tip: For Puppeteer, `local_proxy: true` (default) is recommended so you don't have to implement proxy auth yourself.
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID, // optional
  local_proxy: true, // true is default
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

// Tip: For Selenium, `local_proxy: true` (default) is recommended so you don't have to implement proxy auth yourself.
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID, // optional
  local_proxy: true, // true is default
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

Do this now.

