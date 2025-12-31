---
title: Aluvia Gateway Nodes
description: Introduction to Aluvia Gateway Nodes
sidebar_position: 2
---

# Understanding Aluvia gateway nodes

Aluvia gateway nodes are cloud endpoints that route your traffic through Aluvia's mobile IP network. When your requests pass through a gateway node, they exit onto the internet from trusted mobile IPs, reducing the likelihood of blocks and CAPTCHAs.

Gateway nodes handle authentication, load balancing, and upstream routing. All you need to connect is a set of proxy credentials from a [connection object](/fundamentals/connections).

## How traffic flows

The following diagram shows how traffic flows from your application through a gateway node:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Your App       │──────│  Gateway Node   │──────│  Destination    │
│                 │      │                 │      │                 │
│  Proxy client   │      │  Authenticates  │      │  Sees mobile IP │
│  or Aluvia      │      │  and routes     │      │  not datacenter │
│  Client         │      │  traffic        │      │  IP             │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

Gateway nodes authenticate your request using connection credentials, then forward it through Aluvia's mobile IP network. The destination site sees traffic from a mobile carrier IP.

## Ways to connect

You have two options for routing traffic through gateway nodes:

| Method | Description |
|--------|-------------|
| **Direct from any proxy client** | Configure any HTTP proxy client (curl, Python requests, browser automation tools) to point directly at `gateway.aluvia.io` using your connection credentials. |
| **Using the Aluvia client** | Use the SDK's `AluviaClient` to start a local proxy that routes traffic to gateway nodes based on hostname rules. The client handles credential management and supports live rule updates. |

### Connecting with any proxy client

Any tool or library that supports HTTP proxies can connect directly to gateway nodes. Configure your proxy client with:

- **Proxy host:** `gateway.aluvia.io`
- **Proxy port:** `8080` (HTTP) or `8443` (HTTPS)
- **Username and password:** Credentials from your [connection object](/fundamentals/connections)

For example, with curl:

```bash
curl -x "http://USERNAME:PASSWORD@gateway.aluvia.io:8080" https://example.com
```

### Connecting with the Aluvia Client

The [Aluvia Client](/connect/use-connection) provides a higher-level interface for routing traffic through gateway nodes. When you call `client.start()`, the client:

1. Creates or retrieves a connection from the Aluvia API
2. Starts a local proxy on `127.0.0.1`
3. Routes each request through gateway nodes or direct based on your hostname rules

The client abstracts away credential management and provides adapters for common tools:

```ts
import { chromium } from 'playwright';
import { AluviaClient } from '@aluvia/sdk';

const client = new AluviaClient({ apiKey: process.env.ALUVIA_API_KEY! });
const connection = await client.start();

const browser = await chromium.launch({ proxy: connection.asPlaywright() });
```


## Gateway node information

### Hostname

**gateway.aluvia.io**

You are automatically connected to the optimal node. All gateway nodes are located in the United States.

### Ports and protocols

- Port **8080** for HTTP
- Port **8443** for HTTPS

### Username and password

To authenticate with gateway nodes, use the `proxy_username` and `proxy_password` from a connection object. You can create connections through the [dashboard](https://app.aluvia.io), the [Aluvia API](/api/connections), or the Aluvia Client.



## Related topics

- [Understanding connections](/fundamentals/connections) — Learn about connection objects and their attributes
- [Using a connection](/connect/use-connection) — Configure the Aluvia Client for your use case
- [Managing connections](/connect/manage-connection) — Create, update, and delete connections via the API
