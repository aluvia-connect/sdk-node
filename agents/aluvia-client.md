---
title: Aluvia Client
description: A local proxy and control plane that routes your agent's traffic through Aluvia's mobile IPs
sidebar_position: 3
---

# Understanding the Aluvia client

The Aluvia client (included in the Aluiva node SDK) is the easiest way to integrate Aluvia into your Node.js applications. It runs a local rules-based proxy server on your agent's host, handles authentication and connection management, and provides ready-to-use adapters for popular tools like Playwright, Puppeteer, and Axios.

Point your automation tool at the local proxy address (`127.0.0.1`) and the client handles the rest. For each request, the client checks the destination hostname against user-defined (or agent-defined) routing rules and decides whether to send it through Aluvia's mobile IPs or direct to the destination.


| Benefit | Description |
|---------|-------------|
| **Unblock sites** | Mobile IPs bypass datacenter IP blocking |
| **Reduce costs** | Developers, or the agents themselves, can specify hostnames to proxy. This minimizes cost while preserving reliability. |
| **Update at runtime** | routing rules can be updated on the fly, allowing agents to dynamically respond to website blocks without restarts. |
| **Unified API** | Single SDK with adapters for Playwright, Puppeteer, Axios, and more |

---

## How the Aluvia client works

```
┌──────────────────┐      ┌──────────────────────────┐      ┌──────────────────────┐
│                  │      │                          │      │                      │
│    Your Agent    │─────▶     Aluvia Client         ─────▶  gateway.aluvia.io    │
│                  │      │     127.0.0.1:port       │      │    (Mobile IPs)      │
│                  │      │                          │      │                      │
└──────────────────┘      │  Per-request routing:    │      └──────────────────────┘
                          │                          │
                          │  not-blocked.com ──────────────▶ Direct
                          │  blocked-site.com ─────────────▶ Via Aluvia
                          │                          │
                          └──────────────────────────┘
```

The Aluvia client starts a local proxy server that routes each request based on hostname rules. Traffic can be sent either:
* direct (using the agent's datacenter/cloud IP) or,
* through Aluvia's mobile proxy IPs,

**Rules can be updated at runtime without restarting the agent.**

---

## Aluvia client documentation

* [Aluvia Node SDK](docs/client-technical-guide.md)
* [Technical docs](docs/client-technical-guide.md)
* [How to create a new connection](https://docs.aluvia.io/connect/create-connection)
* [How to use a connection](https://docs.aluvia.io/connect/use-connection)
* [How to manage a connection](https://docs.aluvia.io/connect/manage-connection)


---

## Quick start

### Get Aluvia API key

1. Create an account at [dashboard.aluvia.io](https://dashboard.aluvia.io)
2. Go to **Settings > API Keys** and create an **Account API Key**

### Install the SDK

```bash
npm install @aluvia/sdk
```

**Requirements:** Node.js 18 or later




