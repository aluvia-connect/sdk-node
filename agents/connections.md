---
title: Connections
description: Understanding the Auvia connection object
sidebar_position: 1
---

# Understanding the Aluiva connection object

A connection is the core building block of Aluvia. It represents a set of credentials and configuration that define how you connect to Aluvia's mobile proxy infrastructure. You can create and manage as many connections as you need.

## Connection attributes

Each connection includes the following attributes:

| Attribute | Description |
|-----------|-------------|
| **Connection ID** | Unique identifier for the connection. Pass this to the Aluvia Client to reuse an existing connection. |
| **Username + password** | Credentials for authenticating with Aluvia gateway nodes. |
| **Connection token** | API token scoped to this specific connection. Use with the Aluvia API for connection-level operations. |
| **Session ID** | Controls IP rotation and sticky sessions. Set a session ID to maintain the same IP across requests. |
| **Target geo** | Geographic targeting for IPs (for example, `us_ny` for New York). |
| **Routing rules** | Hostname patterns that determine which traffic routes through Aluvia versus direct. |

### Example connection object

```json
{
  "success": true,
  "data": {
    "connection_id": "3",
    "created_at": 1709000000,
    "description": "pricing-bot-east",
    "proxy_username": "Nkjh78Gh",
    "proxy_password": "zxy987abc",
    "api_token": "alv_connection_token_abc123def456",
    "rules": ["*", "-example.com"],
    "session_id": null,
    "target_geo": "us_ny",
    "proxy_urls": {
      "raw": {
        "protocol": "http",
        "host": "gateway.aluvia.io",
        "port": 8080,
        "username": "Nkjh78Gh",
        "password": "zxy987abc"
      },
      "url": "http://Nkjh78Gh:zxy987abc@gateway.aluvia.io:8080",
      "playwright": {
        "server": "http://Nkjh78Gh:zxy987abc@gateway.aluvia.io:8080"
      },
      "puppeteer": {
        "args": ["--proxy-server=http://gateway.aluvia.io:8080"],
        "auth": {
          "username": "Nkjh78Gh",
          "password": "zxy987abc"
        }
      },
      "python_requests": {
        "http": "http://Nkjh78Gh:zxy987abc@gateway.aluvia.io:8080",
        "https": "http://Nkjh78Gh:zxy987abc@gateway.aluvia.io:8080"
      }
    }
  }
}
```

## Connection lifecycle

Connections follow a straightforward lifecycle:

1. **Create**: Provision a new connection with optional initial settings (rules, geo, description).
2. **Use**: Configure the Aluvia Client or your HTTP client with the connection credentials.
3. **Update**: Modify connection attributes at runtime—change routing rules, rotate IPs with a new session ID, or adjust geo targeting.
4. **Delete**: Remove connections when no longer needed. Connections don't expire and remain active until deleted.

## How to manage connections

You can create, update, and delete connections through three interfaces:

### Dashboard

The [Aluvia dashboard](https://dashboard.aluvia.io) provides a visual interface for managing connections. Use the Connections page to create, view, update, or delete connections manually.

### Aluvia Client

The Aluvia Client manages connections programmatically:

```ts
import { AluviaClient } from '@aluvia/sdk';

// Create a new connection automatically
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
});

// Or use an existing connection
const client = new AluviaClient({
  apiKey: process.env.ALUVIA_API_KEY!,
  connection_id: 'your-connection-id',
});

const connection = await client.start();

// Update attributes at runtime
await client.updateRules(['*.example.com']);
await client.updateSessionId('new-session');
await client.updateTargetGeo('us_ca');

await connection.close();
```

### Aluvia API

For full programmatic control, use the Aluvia API directly:

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });

// List all connections
const connections = await api.account.connections.list();

// Create a new connection
const newConnection = await api.account.connections.create({
  description: 'web-scraper',
  rules: ['*'],
  target_geo: 'us_ny',
});

// Update an existing connection
await api.account.connections.patch(newConnection.connection_id, {
  rules: ['example.com', '*.google.com'],
});

// Delete a connection
await api.account.connections.delete(newConnection.connection_id);
```

### REST API

For direct HTTP access, use the REST API with your account API key:

```bash
# List all connections
curl -X GET "https://api.aluvia.io/v1/account/connections" \
  -H "Authorization: Bearer $ALUVIA_API_KEY" \
  -H "Accept: application/json"

# Create a new connection
curl -X POST "https://api.aluvia.io/v1/account/connections" \
  -H "Authorization: Bearer $ALUVIA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "description": "web-scraper",
    "rules": ["*"],
    "target_geo": "us_ny"
  }'

# Update a connection
curl -X PATCH "https://api.aluvia.io/v1/account/connections/3" \
  -H "Authorization: Bearer $ALUVIA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "rules": ["example.com", "*.google.com"],
    "session_id": "new-session"
  }'

# Delete a connection
curl -X DELETE "https://api.aluvia.io/v1/account/connections/3" \
  -H "Authorization: Bearer $ALUVIA_API_KEY" \
  -H "Accept: application/json"
```
