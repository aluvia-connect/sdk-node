---
title: Create Connection
description: Create a new connection using Aluiva client
sidebar_position: 0

---


# How to create a new connection

You can create new connections at any time. There are two ways to create a connection. 


## Using Aluvia API

The Aluvia SDK provides a convenient Node wrapper for the Aluvia API. 

```ts
import { chromium } from 'playwright-core';
import { AluviaApi } from '@aluvia/sdk';

//Create new connection via API
const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await api.account.connections.create({});

```

Alternatively you can use the API directly. See the API reference docs.


## Using Aluvia dashboard

1. Sign into the dashboard
2. Go to "Connections" page
3. Click "create new"