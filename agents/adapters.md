---
title: Integration Adapters
description: Pre-built adapters for connecting Aluvia to popular tools and frameworks
sidebar_position: 4
---

# Integration Adapters

Integration adapters output proxy configuration in the exact format required by each tool. Instead of learning each library's proxy configuration quirks, call the appropriate method on your connection object and pass the result directly to your tool.


## Available integration adapters

| Adapter | Method | Returns | Best for |
|---------|--------|---------|----------|
| Playwright | `asPlaywright()` | `{ server, username?, password? }` | Browser automation with Chromium, Firefox, WebKit |
| Puppeteer | `asPuppeteer()` | `['--proxy-server=...']` | Headless Chrome automation |
| Selenium | `asSelenium()` | `'--proxy-server=...'` | Cross-browser testing |
| Axios | `asAxiosConfig()` | `{ proxy: false, httpAgent, httpsAgent }` | Promise-based HTTP requests |
| got | `asGotOptions()` | `{ agent: { http, https } }` | Human-friendly HTTP requests |
| fetch | `asUndiciFetch()` | Proxy-enabled `fetch` function | Modern fetch-style requests |
| Node.js HTTP | `asNodeAgents()` | `{ http: Agent, https: Agent }` | Low-level HTTP clients |
| undici | `asUndiciDispatcher()` | `undici.Dispatcher` | High-performance HTTP client |

## Usage Examples

see the Use Connection document for detailed examples

## Behavior by operating mode

The Aluvia client supports two operating modes:

- **Client proxy mode** (default): The SDK runs a local proxy on `127.0.0.1`. Your tools connect to this local proxy, which handles routing and keeps gateway credentials internal.
- **Gateway mode**: No local proxy. Your tools connect directly to `gateway.aluvia.io` with embedded credentials.

Integration adapters behave differently depending on which mode you use:

| Adapter | Client proxy mode | Gateway mode |
|---------|-------------------|--------------|
| `asPlaywright()` | `{ server }` (local proxy) | `{ server, username, password }` |
| `asPuppeteer()` | Local proxy URL | Gateway URL (requires auth handling) |
| `asSelenium()` | Local proxy URL | Gateway URL (requires auth handling) |
| `asAxiosConfig()` | Agents pointing to local proxy | Agents with embedded credentials |
| `asGotOptions()` | Agents pointing to local proxy | Agents with embedded credentials |
| `asUndiciFetch()` | Fetch via local proxy | Fetch via gateway with credentials |
| `asNodeAgents()` | Agents pointing to local proxy | Agents with embedded credentials |
| `asUndiciDispatcher()` | Dispatcher via local proxy | Dispatcher via gateway with credentials |

In client proxy mode (default), credentials stay internal to the SDK. In gateway mode, some adapters include credentials in the returned configuration.



## More resources

- [Playwright integration guide](/docs/integrations/integration-playwright)
- [Puppeteer integration guide](/docs/integrations/integration-puppeteer)
- [Selenium integration guide](/docs/integrations/integration-selenium)
- [Axios integration guide](/docs/integrations/integration-axios)
- [got integration guide](/docs/integrations/integration-got)
- [fetch integration guide](/docs/integrations/integration-fetch)
