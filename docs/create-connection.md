# How to create a new connection 




You can create and configure a connection before starting the Aluvia Client. 
If you don't create a connection, the Aluiva client will automatically create on for you. 


There are two ways to create a connection. 

## Using API


The Aluiva SDK provides convient Node and Python wrappers for the Aluvia API. Alternatively you can use the API directly. 


```ts
import { chromium } from 'playwright-core';
import { AluviaApi } from '@aluvia/aluvia-sdk-node';

//Create new connection via API
const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await api.account.connections.create({});

```


## Using Alluvia dashbaord

1. Sign into dashbaord
2. Go to "Connections" page
3. Click "create new"