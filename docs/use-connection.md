# Using your connection 


## Install and start aluiva client

Include your Aluvia API KEY
If you have an exisitng connection you would like to use, include its connection ID. If you do not include a connection ID, the client will automatically create a new connection. 
Remember to include client.stop() when you're done.


```ts
import { chromium } from 'playwright-core';
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

//Start client with optional connection ID
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!, //required
  connection_id: process.env.ALUVIA_CONNECTION_ID!, //optional
});
const connection = await client.start();

//Integration and automation code...

//Stop client
await client.stop();

```

## Client configuration options

Below are all the available coniguration settings:

```ts
new AluviaClient({
  apiKey: string,                 // required
  connection_id?: string,         // optional
  local_proxy?: boolean,        // optional, default true
  apiBaseUrl?: string,            // optional, default https://api.aluvia.io/v1
  pollIntervalMs?: number,        // optional, default 5000
  timeoutMs?: number,             // optional, default 30000 (API wrapper + control plane HTTP)
  gatewayProtocol?: 'http'|'https', // optional, default http
  gatewayPort?: number,           // optional, default 8080 or 8443 depending on protocol
  localPort?: number,             // optional; only relevant when local_proxy true
  logLevel?: 'silent'|'info'|'debug', // optional, default info
});
```




## Integrate with tools


The Aluiva Client outputs pre-formatted integration code for a variety of automation tools.


### Playwright

```ts
import { chromium } from 'playwright-core';
import { AluviaClient } from '@aluvia/aluvia-sdk-node';

//Start client with optional connection ID
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!, //required
  connection_id: process.env.ALUVIA_CONNECTION_ID!, //optional
});
const connection = await client.start();

//Connect Playwright
const browser = await chromium.launch({ proxy: connection.asPlaywright() });

//Run actions
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://ipconfig.io/json');
await browser.close();

//Stop client
await client.stop();
```

