# Enhanced Page Load Detection

This example demonstrates the enhanced page load detection feature that can automatically detect when pages are blocked by captchas or other anti-bot measures.

## Features

- **Keyword Detection**: Searches page content for blocking keywords (captcha, blocked, access denied, etc.)
- **Status Code Detection**: Monitors HTTP status codes (403, 429, 503)
- **Automatic Rule Addition**: Optionally add blocked hostnames to routing rules automatically
- **Custom Callbacks**: Get notified when blocking is detected

## Basic Usage

### 1. Enable Detection with Playwright

```typescript
import { AluviaClient } from "@aluvia/sdk";

const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
  },
});

const connection = await client.start();
const browser = connection.browser;

// Detection runs automatically for all pages
const page = await browser.newPage();
await page.goto("https://example.com");
```

### 2. Automatic Rule Addition

When `autoAddRules` is enabled, blocked hostnames are automatically added to routing rules:

```typescript
const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    autoAddRules: true, // Automatically add blocked hostnames to rules
  },
});

const connection = await client.start();
const browser = connection.browser;

const page = await browser.newPage();

// First attempt: bypasses Aluvia (default behavior)
await page.goto("https://example.com");

// If captcha detected:
// 1. Hostname automatically added to rules
// 2. Next request will go through Aluvia proxy
// 3. Logs: "Auto-adding example.com to routing rules due to blocking detection"

// Retry the page (now will use Aluvia proxy)
await page.goto("https://example.com");
```

### 3. Custom Blocking Detection Callback

Get notified when blocking is detected:

```typescript
const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    onBlockingDetected: async (hostname, reason) => {
      console.log(`Blocking detected on ${hostname}`);
      console.log(`Reason: ${reason.details}`);
      console.log(`Type: ${reason.type}`);

      if (reason.type === "keyword") {
        console.log(`Keyword found: ${reason.keyword}`);
      } else if (reason.type === "status_code") {
        console.log(`Status code: ${reason.statusCode}`);
      }

      // You can also rotate IP here
      await client.updateSessionId(`retry-${Date.now()}`);
    },
  },
});
```

### 4. Customize Detection Keywords and Status Codes

```typescript
const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    blockingKeywords: [
      "captcha",
      "blocked",
      "access denied",
      "cloudflare",
      // Add your custom keywords
      "rate limit",
      "too many requests",
    ],
    blockingStatusCodes: [403, 429, 503, 401],
    minContentLength: 200, // Pages shorter than this might have failed
  },
});
```

### 5. Manual Retry Pattern

Combine with manual retry logic:

```typescript
const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    autoAddRules: true,
  },
});

const connection = await client.start();
const browser = connection.browser;

async function visitWithRetry(url: string, maxRetries = 3): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const hostname = new URL(url).hostname;
      const blockedHostnames = client.getBlockedHostnames();

      if (blockedHostnames.includes(hostname)) {
        // This page was detected as blocked, but autoAddRules already added it
        // Rotate IP for next attempt
        await client.updateSessionId(`retry-${Date.now()}`);
        await page.close();

        if (i < maxRetries - 1) {
          console.log(`Retrying ${url} (attempt ${i + 2}/${maxRetries})`);
          continue;
        }
      }

      // Success
      const content = await page.content();
      await page.close();
      return content;
    } catch (error) {
      await page.close();
      if (i === maxRetries - 1) throw error;
      console.log(`Error on attempt ${i + 1}, retrying...`);
    }
  }

  throw new Error("Max retries reached");
}

// Use it
const content = await visitWithRetry("https://example.com");
console.log("Successfully fetched content");
```

### 6. Check Blocked Hostnames

```typescript
// Get list of hostnames detected as blocked
const blockedHostnames = client.getBlockedHostnames();
console.log("Blocked hostnames:", blockedHostnames);

// Clear the blocked hostnames list
client.clearBlockedHostnames();
```

## Configuration Options

```typescript
type PageLoadDetectionConfig = {
  // Enable/disable detection (default: true)
  enabled?: boolean;

  // Keywords to search for (case-insensitive)
  // Default: ['captcha', 'blocked', 'access denied', 'forbidden', 'cloudflare', ...]
  blockingKeywords?: string[];

  // HTTP status codes that indicate blocking
  // Default: [403, 429, 503]
  blockingStatusCodes?: number[];

  // Minimum content length for successful page load
  // Default: 100
  minContentLength?: number;

  // Automatically add hostname to rules when blocking detected
  // Default: false
  autoAddRules?: boolean;

  // Callback when blocking is detected
  onBlockingDetected?: (
    hostname: string,
    reason: BlockingReason,
  ) => void | Promise<void>;
};

type BlockingReason = {
  type: "status_code" | "keyword" | "content_length" | "error";
  details: string;
  statusCode?: number;
  keyword?: string;
};
```

## Default Detection Keywords

The following keywords are detected by default (case-insensitive):

- `captcha`
- `blocked`
- `access denied`
- `forbidden`
- `cloudflare`
- `please verify`
- `recaptcha`
- `hcaptcha`
- `bot detection`
- `automated access`
- `unusual activity`
- `verify you are human`
- `security check`
- `access restricted`

## Default Blocking Status Codes

- `403` - Forbidden
- `429` - Too Many Requests
- `503` - Service Unavailable

## How It Works

1. **By Default**: All requests bypass Aluvia (no routing rules)
2. **Detection**: When a page loads, the SDK checks for:
   - Blocking keywords in page content and title
   - Specific HTTP status codes
   - Unusually short page content
3. **Auto-Add Rules** (if enabled): Blocked hostname is added to routing rules
4. **Next Request**: Future requests to that hostname go through Aluvia proxy
5. **Callback**: Your custom callback is triggered (if provided)

## Best Practices

1. **Start with autoAddRules: false** and use callbacks to understand what's being detected
2. **Customize keywords** based on the sites you're scraping
3. **Combine with session rotation** to get fresh IPs when blocking is detected
4. **Monitor blocked hostnames** using `getBlockedHostnames()`
5. **Clear blocked hostnames** periodically if you want to retry without proxy

## Notes

- Detection only works when `startPlaywright: true` is enabled
- Blocked hostnames are stored in-memory and cleared when client stops
- The detection runs on the `domcontentloaded` event
- You can disable detection at any time by passing `enabled: false`
