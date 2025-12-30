---
title: Create Connection
description: Create a new connection using the Aluvia SDK
sidebar_position: 0

---


# How to create a new connection

There are **three ways** to create a new connection:

- **Starting the Aluvia client (`AluviaClient`)**: If you don’t provide `connectionId`, the client creates a new account connection automatically during startup.
- **Using the Aluvia API wrapper (`AluviaApi`)**: Create a connection directly via `POST /account/connections`.
- **Manually in the Aluvia dashboard**: Create a connection in the UI.



## Create connection using the Aluvia client

Starting `AluviaClient` creates a new account connection **when `connectionId` is omitted**.

```ts
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });

// Omitting `connectionId` makes `start()` create a new connection
const connection = await client.start();

// Integration and automation code...

await connection.close(); // recommended cleanup
```


## Create connection using the Aluvia API

Use `AluviaApi` to create a connection programmatically without starting `AluviaClient` (and without starting any local proxy processes). The SDK provides a Node wrapper around the Aluvia REST API.

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

const accountConnection = await api.account.connections.create({ target_geo: 'US' });

console.log('Created connection:', accountConnection.id ?? accountConnection.connection_id);
```

Alternatively, you can call the API directly (`POST /account/connections`). See the API reference docs.


## Using Aluvia dashboard

1. Sign in to the Aluvia dashboard.
2. Go to **Connections**.
3. Click **Create new**.
