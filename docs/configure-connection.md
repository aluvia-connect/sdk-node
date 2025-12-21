
# Configure a connection 


## Update session ID


```ts
import { chromium } from 'playwright-core';
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

//New connection, gateway mode
const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY!, local_proxy: false });
const connection = await client.start();

//Update connection's session ID
await client.updateSessionId('my-session-id1');

//Connect Playwright
const browser = await chromium.launch({ proxy: connection.asPlaywright() });

//Run actions
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://ipconfig.io/json');
await browser.close();

//Change session ID
await client.updateSessionId('my-session-id2');

//Run actions
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://ipconfig.io/json');
await browser.close();

//Stop client
await client.stop();
```


## Update routing rules