# Playwright (new connection, gateway mode)


```ts
import { chromium } from 'playwright-core';
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

//Connect Playwright with new connection ID, no smart routing
const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();
const browser = await chromium.launch({ proxy: connection.asPlaywright() });

//Run actions
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://ipconfig.io/json');
await browser.close();

//Stop client
await client.stop();
```


## Playwright (existing connection, gateway mode)

```ts
import { chromium } from 'playwright-core';
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

//Connect Playwright with existing connection ID, no smart routing
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID!,
});
const connection = await client.start();
const browser = await chromium.launch({ proxy: connection.asPlaywright() });

//Run actions
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://ipconfig.io/json');
await browser.close();

//Stop client
await client.stop();
```



## Playwright (existing connection, smart routing)

```ts
import { chromium } from 'playwright-core';
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

//Connect Playwright with existing connection ID, smart routing
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID!,
  smart_routing: true,
});
const connection = await client.start();
const browser = await chromium.launch({ proxy: connection.asPlaywright() });

//Run actions
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://ipconfig.io/json');
await browser.close();

//Stop client
await client.stop();
```

