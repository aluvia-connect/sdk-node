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

The document @docs/create-connection.md should have the following parts. Please review carefully and update the doc to align it with the outline below:

# How to create a new connection
Write a very brief overview introduction explaining that there are three ways to create a new connection.
**Starting the Aluvia client (`AluviaClient`)**: if you don’t provide `connection_id`, client will **create a new account connection** automatically during startup.
- **Using the Aluvia API wrapper (`AluviaApi`)**: create a connection directly via `POST /account/connections`.
- **Manually in the Aluvia dashboard**


## Create connection using the Aluvia client

Write a very brief overview introduction explaining that starting `AluviaClient` creates a new account connection **when `connection_id` is omitted**

Generate concise example code that shows how starting the aluvia client creates a new connection. It should look something like this:

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });

// Omitting `connection_id` makes `start()` create a new connection 
const connection = await client.start();

// Integration and automation code...

await connection.close(); // recommended cleanup
```


## Create connection using the Aluvia API

Write a very brief overview introduction explaining that developers can use the API to create a connection programmatically, without having to start the Aluvia client and all its associated processes (e.g. a local proxy server). The Aluvia SDK provides a convenient Node wrapper for the Aluvia API.

Generate concise example code that shows how to create a new connection using our SDK api wrapper. It should look something like this:

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

const accountConnection = await api.account.connections.create({ target_geo: 'US' });

console.log('Created connection:', accountConnection.id ?? accountConnection.connection_id);
```

Alternatively developers can use the API directly: `POST /account/connections`.
See the API reference docs.


## Using Aluvia dashboard

1. Sign into the dashboard
2. Go to "Connections" page
3. Click "create new"



Write this documentation now.