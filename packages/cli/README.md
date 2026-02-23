# @aluvia/cli

The official command-line interface for [Aluvia](https://aluvia.io) — launch and manage browser sessions with automatic unblocking, smart routing, and resident proxy daemons.

## Installation

```bash
npm install -g @aluvia/cli
```

## Get an Aluvia API Key

You need an API key to use the CLI. Get one from the [Aluvia dashboard](https://dashboard.aluvia.io):

1. Sign up or sign in at [dashboard.aluvia.io](https://dashboard.aluvia.io)
2. In your account, open the API & SDKs section
3. Copy your API key

## Setup

Set your API key as an environment variable:

```bash
export ALUVIA_API_KEY="aluvia_..."
```

Or add `ALUVIA_API_KEY=...` to a `.env` file (never commit it).

## Features

- **Resident Browser Sessions**: Launches a headless Chromium instance managed by a background daemon.
- **Auto-Unblocking**: Automatically detects blocks (403s, CAPTCHAs) and rotates IPs/headers to bypass them.
- **Script Injection**: Run ephemeral scripts against the browser session with zero boilerplate.
- **Live Control**: Rotate IPs, change geo-targeting, and update routing rules on running sessions.
- **JSON Output**: All commands output structured JSON, making this CLI ideal for building agents and tools.

## Command Reference

Run `aluvia help` for a quick list of commands, or `aluvia help --json` for machine-readable output.

### `session start`

Starts a new browser session. This spawns a background daemon that manages the browser and proxy.

```bash
aluvia session start <url> [options]
```

**Options:**

- `--auto-unblock`: **(Recommended)** Enable automatic block detection and unblocking.
- `--headful`: Show the browser window (useful for debugging).
- `--run <script>`: Run a JavaScript/TypeScript module immediately after the session starts.
- `--browser-session <name>`: Assign a custom name to the session (default: auto-generated like `swift-falcon`).
- `--connection-id <id>`: Reuse an existing Aluvia connection ID (persists rules/history).
- `--disable-block-detection`: Turn off all block detection features.

**Examples:**

```bash
# Start a session with auto-unblocking
aluvia session start https://example.com --auto-unblock

# Start a visible browser (headful)
aluvia session start https://google.com --headful

# Run a script and exit
aluvia session start https://example.com --auto-unblock --run ./scrape.mjs
```

### `session list`

Lists all active browser sessions managed by the CLI.

```bash
aluvia session list
```

**Output:**

```json
{
  "sessions": [
    {
      "browserSession": "swift-falcon",
      "pid": 12345,
      "startUrl": "https://example.com",
      "cdpUrl": "http://127.0.0.1:39201",
      "connectionId": 5592,
      "autoUnblock": true
    }
  ],
  "count": 1
}
```

### `session get`

Retrieves detailed information about a specific session, including its CDP endpoint and Proxy URL.

```bash
aluvia session get [--browser-session <name>]
```

If only one session is running, it is selected automatically.

### `session close`

Stops a browser session and kills the background daemon.

```bash
aluvia session close [--browser-session <name>] [--all]
```

- `--all`: Close all running sessions.

### `session rotate-ip`

Forces an IP rotation for the current session. The connection ID remains the same, but the exit node changes.

```bash
aluvia session rotate-ip [--browser-session <name>]
```

### `session set-geo`

Updates the target geography for the session's exit node.

```bash
aluvia session set-geo <geo_code> [--browser-session <name>]
aluvia session set-geo --clear
```

- `<geo_code>`: A geo code (e.g., `us`, `us_ca`, `us_ny`). See `aluvia geos` for a full list.
- `--clear`: Remove geo targeting (use any available IP).

### `session set-rules`

Updates the routing rules for the session. These rules determine which domains are routed through Aluvia's proxy network versus direct connections.

```bash
# Append rules
aluvia session set-rules "example.com,api.example.com"

# Remove rules
aluvia session set-rules --remove "example.com"
```

### `account` & `geos`

- `aluvia account`: View your current balance and account status.
- `aluvia account usage`: View usage statistics (bandwidth, requests).
  - `--start <ISO8601>` / `--end <ISO8601>`: Filter by date range.
- `aluvia geos`: List all available regions for geo-targeting.

## Scripting (`--run`)

You can pass a script to `session start` to execute automation logic immediately. The CLI injects `page`, `browser`, and `context` (Playwright objects) into the global scope.

**script.mjs:**

```javascript
// 'page' is already navigated to the start URL
console.log('Title:', await page.title());

// You can use standard Playwright API
await page.click('button.login');
console.log('Logged in!');

// The session closes automatically when this script finishes
```

**Run it:**

```bash
aluvia session start https://example.com --auto-unblock --run script.mjs
```

## Connecting from SDK

You can also connect to a CLI-managed session from your own Node.js code using the `@aluvia/sdk` package.

```typescript
import { connect } from '@aluvia/sdk';

// Connects to the active session
const { page, browser } = await connect();

await page.goto('https://another-site.com');
```

See the [SDK Documentation](../sdk/README.md) for more details.

## Troubleshooting

- **"ALUVIA_API_KEY environment variable is required"**: Ensure you have exported your API key in your shell configuration (`.bashrc`, `.zshrc`) or current session.
- **"Browser process exited unexpectedly"**: The daemon failed to start. Check if Chrome/Chromium is installed or if there are port conflicts.
- **"Invalid session name"**: Session names must contain only letters, numbers, hyphens, and underscores.

## License

MIT
