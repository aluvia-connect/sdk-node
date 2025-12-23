---
title: Configure Connection
description: Configure a connection with the Aluiva client
sidebar_position: 2

---


# Configure a connection 


You can use the client to update various connection attributes that allow you to leverage features such as rotating IPs geotargeting IPs, or setting hostname routing rules.


## Update session ID

This facilitates sticky sessions and IP rotation

```ts
import { chromium } from 'playwright-core';
import { AluviaClient } from '@aluvia/sdk';

//Start client with connection ID
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: process.env.ALUVIA_CONNECTION_ID!,
});
const connection = await client.start();

//Update connection's session ID
await client.updateSessionId('id1');

// Launch Playwright
const browser = await chromium.launch({
  proxy: connection.asPlaywright(),
});

const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://ipconfig.io/json');

//Change session ID 
await client.updateSessionId('id2');
await page.goto('https://ipconfig.io/json');

await browser.close();

// Close connection (recommended cleanup)
await connection.close();
```


## Update routing rules

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ 
  apiKey: process.env.ALUVIA_API_KEY! 
});
const connection = await client.start();

// Proxy everything except example.com
await client.updateRules(['*', '-example.com']);

// Close connection (recommended cleanup)
await connection.close();
```
