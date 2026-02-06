# Enhanced Page Load Detection

This example demonstrates the enhanced page load detection feature that can automatically detect when pages are blocked by captchas or other anti-bot measures.

## Features

- **Keyword Detection**: Searches page content for blocking keywords (captcha, blocked, access denied, etc.)
- **Status Code Detection**: Monitors HTTP status codes (403, 429, 503)
- **Automatic Rule Addition & Reload**: By default, blocked hostnames are added to routing rules and the page is reloaded
- **Custom Callbacks**: Override the default behavior with custom callbacks

## Basic Usage

### 1. Enable Detection with Playwright (Default Behavior)

By default, when blocking is detected, the SDK will:

1. Add the hostname to routing rules
2. Reload the page automatically

```typescript
import { AluviaClient } from "@aluvia/sdk";

const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  // Page load detection is enabled by default with startPlaywright
});

const connection = await client.start();
const browser = connection.browser;

// Detection runs automatically for all pages
// If blocking is detected, hostname is added to rules and page reloads
const page = await browser.newPage();
await page.goto("https://example.com");
```

### 2. Explicit Page Load Detection Config

```typescript
const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    // Default behavior: add hostname to rules and reload page
  },
});
```

### 3. Custom Blocking Detection Callback

Override the default behavior with your own callback:

```typescript
const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    onBlockingDetected: async (hostname, reason, page) => {
      console.log(`Blocking detected on ${hostname}`);
      console.log(`Reason: ${reason.details}`);
      console.log(`Type: ${reason.type}`);

      if (reason.type === "keyword") {
        console.log(`Keyword found: ${reason.keyword}`);
      } else if (reason.type === "status_code") {
        console.log(`Status code: ${reason.statusCode}`);
      }

      // Custom handling: rotate IP and reload
      await client.updateSessionId(`retry-${Date.now()}`);
      await page.reload();
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

### 5. Custom Callback with Auto-Add Rules

If you want a custom callback AND automatic rule addition:

```typescript
const client = new AluviaClient({
  apiKey: "your-api-key",
  startPlaywright: true,
  pageLoadDetection: {
    enabled: true,
    autoAddRules: true, // Will add hostname to rules after your callback
    onBlockingDetected: async (hostname, reason, page) => {
      console.log(`Blocking detected: ${hostname}`);
      // Your custom logic here
      // After this callback, the hostname will be auto-added to rules
    },
  },
});
```

### 6. Manual Retry Pattern

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
  // Only used when a custom onBlockingDetected callback is provided
  // Default: false
  autoAddRules?: boolean;

  // Callback when blocking is detected
  // If not provided, default behavior is to add hostname to rules and reload page
  onBlockingDetected?: (
    hostname: string,
    reason: BlockingReason,
    page: any,
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
3. **Default Behavior**: When blocking is detected:
   - Hostname is added to routing rules
   - Page is automatically reloaded
4. **Next Request**: The reloaded page (and future requests) go through Aluvia proxy
5. **Custom Callback**: If you provide `onBlockingDetected`, the default behavior is replaced with your callback

## Best Practices

1. **Use default behavior** for simple use cases - it handles blocking automatically
2. **Provide custom callback** when you need specific handling (e.g., rotate IP, notify external service)
3. **Customize keywords** based on the sites you're scraping
4. **Monitor blocked hostnames** using `getBlockedHostnames()`
5. **Clear blocked hostnames** periodically if you want to retry without proxy

## Notes

- Detection only works when `startPlaywright: true` is enabled
- Blocked hostnames are stored in-memory and cleared when client stops
- The detection runs on the `domcontentloaded` event
- You can disable detection at any time by passing `enabled: false`
