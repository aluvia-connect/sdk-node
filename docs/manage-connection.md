---
title: Manage Connection
description: Update connection attributes with the Aluvia SDK
sidebar_position: 2

---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';


# Manage a connection

`AluviaClient` leverages the Aluvia API to update connection attributes. This allows you to do things like set routing rules, change IP address, or geo target IPs.

Of course, you can also use the flexible Aluvia API for custom workflows. The Aluvia SDK offers language-specific API wrappers.

## Updating attributes with Aluvia Client

- **`client.updateSessionId(sessionId)`**: PATCH `/account/connections/:id` (updates `session_id`)
- **`client.updateRules(rules)`**: PATCH `/account/connections/:id` (updates `rules`)
- **`client.updateTargetGeo(targetGeo)`**: PATCH `/account/connections/:id` (updates `target_geo`)
- **`client.api.account.connections.patch(connectionId, body)`**: PATCH `/account/connections/:id` (custom updates, including multi-attribute patches)



### Update session ID

Use session IDs for sticky sessions and IP rotation.

To update a session ID, you must provide a `connectionId` so the SDK can PATCH your account connection.

<Tabs groupId="node-tools">
<TabItem value="playwright" label="Playwright" default>

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update session_id
});

const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // "Session 1"
  await client.updateSessionId('session1');
  await page.goto('https://ipconfig.io/json');

  // "Session 2"
  await client.updateSessionId('session2');
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
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update session_id
  localProxy: true, // true is default
});

const connection = await client.start();

const browser = await puppeteer.launch({
  headless: true,
  args: connection.asPuppeteer(),
});

try {
  const page = await browser.newPage();

  // "Session 1"
  await client.updateSessionId('session1');
  await page.goto('https://ipconfig.io/json', { waitUntil: 'domcontentloaded' });

  // "Session 2"
  await client.updateSessionId('session2');
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
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update session_id
  localProxy: true, // true is default
});

const connection = await client.start();

try {
  const options = new chrome.Options();
  options.addArguments(connection.asSelenium());

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  try {
    // "Session 1"
    await client.updateSessionId('session1');
    await driver.get('https://ipconfig.io/json');

    // "Session 2"
    await client.updateSessionId('session2');
    await driver.get('https://ipconfig.io/json');
  } finally {
    await driver.quit();
  }
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="fetch" label="Fetch">

```ts
import { AluviaClient } from '@aluvia/sdk';

// Node's built-in fetch does not accept Node proxy agents. Use the undici-powered fetch adapter.
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update session_id
});
const connection = await client.start();

const fetch = connection.asUndiciFetch();

try {
  // "Session 1"
  await client.updateSessionId('session1');
  console.log(await (await fetch('https://ipconfig.io/json')).json());

  // "Session 2"
  await client.updateSessionId('session2');
  console.log(await (await fetch('https://ipconfig.io/json')).json());
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="axios" label="Axios">

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update session_id
});
const connection = await client.start();

try {
  // "Session 1"
  await client.updateSessionId('session1');
  console.log((await axios.get('https://ipconfig.io/json', connection.asAxiosConfig())).data);

  // "Session 2"
  await client.updateSessionId('session2');
  console.log((await axios.get('https://ipconfig.io/json', connection.asAxiosConfig())).data);
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="got" label="Got">

```ts
import got from 'got';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update session_id
});
const connection = await client.start();

try {
  // "Session 1"
  await client.updateSessionId('session1');
  console.log(await got('https://ipconfig.io/json', connection.asGotOptions()).json());

  // "Session 2"
  await client.updateSessionId('session2');
  console.log(await got('https://ipconfig.io/json', connection.asGotOptions()).json());
} finally {
  await connection.close();
}
```

</TabItem>
</Tabs>

### Update routing rules

To update routing rules, you must provide a `connectionId` so the SDK can PATCH your account connection.

<Tabs groupId="node-tools">
<TabItem value="playwright" label="Playwright" default>

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update rules
});
const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Rules 1: proxy ipconfig.io only
  await client.updateRules(['ipconfig.io']);
  await page.goto('https://ipconfig.io/json');

  // Rules 2: add a new rule (also proxy example.com)
  await client.updateRules(['ipconfig.io', 'example.com']);
  await page.goto('https://example.com');
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
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update rules
  localProxy: true, // true is default
});
const connection = await client.start();

const browser = await puppeteer.launch({
  headless: true,
  args: connection.asPuppeteer(),
});

try {
  const page = await browser.newPage();

  // Rules 1: proxy ipconfig.io only
  await client.updateRules(['ipconfig.io']);
  await page.goto('https://ipconfig.io/json', { waitUntil: 'domcontentloaded' });

  // Rules 2: add a new rule (also proxy example.com)
  await client.updateRules(['ipconfig.io', 'example.com']);
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
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
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update rules
  localProxy: true, // true is default
});
const connection = await client.start();

try {
  const options = new chrome.Options();
  options.addArguments(connection.asSelenium());

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  try {
    // Rules 1: proxy ipconfig.io only
    await client.updateRules(['ipconfig.io']);
    await driver.get('https://ipconfig.io/json');

    // Rules 2: add a new rule (also proxy example.com)
    await client.updateRules(['ipconfig.io', 'example.com']);
    await driver.get('https://example.com');
  } finally {
    await driver.quit();
  }
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="fetch" label="Fetch">

```ts
import { AluviaClient } from '@aluvia/sdk';

// Node's built-in fetch does not accept Node proxy agents. Use the undici-powered fetch adapter.
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update rules
});
const connection = await client.start();

const fetch = connection.asUndiciFetch();

try {
  // Rules 1: proxy ipconfig.io only
  await client.updateRules(['ipconfig.io']);
  console.log(await (await fetch('https://ipconfig.io/json')).json());

  // Rules 2: add a new rule (also proxy example.com)
  await client.updateRules(['ipconfig.io', 'example.com']);
  console.log((await fetch('https://example.com')).status);
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="axios" label="Axios">

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update rules
});
const connection = await client.start();

try {
  // Rules 1: proxy ipconfig.io only
  await client.updateRules(['ipconfig.io']);
  console.log((await axios.get('https://ipconfig.io/json', connection.asAxiosConfig())).data);

  // Rules 2: add a new rule (also proxy example.com)
  await client.updateRules(['ipconfig.io', 'example.com']);
  console.log((await axios.get('https://example.com', connection.asAxiosConfig())).status);
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="got" label="Got">

```ts
import got from 'got';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update rules
});
const connection = await client.start();

try {
  // Rules 1: proxy ipconfig.io only
  await client.updateRules(['ipconfig.io']);
  console.log(await got('https://ipconfig.io/json', connection.asGotOptions()).json());

  // Rules 2: add a new rule (also proxy example.com)
  await client.updateRules(['ipconfig.io', 'example.com']);
  const res = await got('https://example.com', connection.asGotOptions());
  console.log(res.statusCode);
} finally {
  await connection.close();
}
```

</TabItem>
</Tabs>

### Update target geo

Set geo targeting, or pass `null` to clear geo targeting.

To update geo targeting, you must provide a `connectionId` so the SDK can PATCH your account connection.

<Tabs groupId="node-tools">
<TabItem value="playwright" label="Playwright" default>

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update target_geo
});
const connection = await client.start();

const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Geo 1 (example: CA)
  await client.updateTargetGeo('CA');
  await page.goto('https://ipconfig.io/json');

  // Geo 2 (example: NY)
  await client.updateTargetGeo('NY');
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
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update target_geo
  localProxy: true, // true is default
});
const connection = await client.start();

const browser = await puppeteer.launch({
  headless: true,
  args: connection.asPuppeteer(),
});

try {
  const page = await browser.newPage();

  // Geo 1 (example: CA)
  await client.updateTargetGeo('CA');
  await page.goto('https://ipconfig.io/json', { waitUntil: 'domcontentloaded' });

  // Geo 2 (example: NY)
  await client.updateTargetGeo('NY');
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
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update target_geo
  localProxy: true, // true is default
});
const connection = await client.start();

try {
  const options = new chrome.Options();
  options.addArguments(connection.asSelenium());

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  try {
    // Geo 1 (example: CA)
    await client.updateTargetGeo('CA');
    await driver.get('https://ipconfig.io/json');

    // Geo 2 (example: NY)
    await client.updateTargetGeo('NY');
    await driver.get('https://ipconfig.io/json');
  } finally {
    await driver.quit();
  }
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="fetch" label="Fetch">

```ts
import { AluviaClient } from '@aluvia/sdk';

// Node's built-in fetch does not accept Node proxy agents. Use the undici-powered fetch adapter.
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connectionId: process.env.ALUVIA_CONNECTION_ID!, // required to update target_geo
});
const connection = await client.start();

const fetch = connection.asUndiciFetch();

try {
  // Geo 1 (example: CA)
  await client.updateTargetGeo('CA');
  console.log(await (await fetch('https://ipconfig.io/json')).json());

  // Geo 2 (example: NY)
  await client.updateTargetGeo('NY');
  console.log(await (await fetch('https://ipconfig.io/json')).json());
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="axios" label="Axios">

```ts
import axios from 'axios';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID!, // required to update target_geo
});
const connection = await client.start();

try {
  // Geo 1 (example: CA)
  await client.updateTargetGeo('CA');
  console.log((await axios.get('https://ipconfig.io/json', connection.asAxiosConfig())).data);

  // Geo 2 (example: NY)
  await client.updateTargetGeo('NY');
  console.log((await axios.get('https://ipconfig.io/json', connection.asAxiosConfig())).data);
} finally {
  await connection.close();
}
```

</TabItem>
<TabItem value="got" label="Got">

```ts
import got from 'got';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID!, // required to update target_geo
});
const connection = await client.start();

try {
  // Geo 1 (example: CA)
  await client.updateTargetGeo('CA');
  console.log(await got('https://ipconfig.io/json', connection.asGotOptions()).json());

  // Geo 2 (example: NY)
  await client.updateTargetGeo('NY');
  console.log(await got('https://ipconfig.io/json', connection.asGotOptions()).json());
} finally {
  await connection.close();
}
```

</TabItem>
</Tabs>

### Update other attributes (API wrapper)

Use the SDK’s API wrapper when you want to update multiple attributes in a single request, or when you need to set an attribute that does not have a dedicated `AluviaClient` helper.

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });

await client.api.account.connections.patch(process.env.ALUVIA_CONNECTION_ID!, {
  session_id: 'session1',
  target_geo: 'CA',
});
```
