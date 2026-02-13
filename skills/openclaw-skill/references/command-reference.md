# Aluvia CLI Command Reference

Complete reference for every CLI command. All commands output JSON to stdout with exit code 0 (success) or 1 (error).

---

## session start

Launch a headless Chromium browser routed through Aluvia's mobile proxy network. The browser runs as a background daemon.

```bash
aluvia session start <url> [options]
```

### Arguments

| Argument | Required | Description                       |
| -------- | -------- | --------------------------------- |
| `<url>`  | Yes      | URL to navigate to in the browser |

### Options

| Flag                        | Type    | Default        | Description                                                                                                  |
| --------------------------- | ------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `--auto-unblock`            | boolean | `false`        | Auto-detect blocks and reload through Aluvia                                                                 |
| `--run <script>`            | string  | —              | Path to a script file. `page`, `browser`, `context` injected as globals. Session exits when script finishes. |
| `--headful`                 | boolean | `false`        | Show the browser window (default: headless)                                                                  |
| `--browser-session <name>`  | string  | auto-generated | Name for this session (e.g. `swift-falcon` if omitted)                                                       |
| `--connection-id <id>`      | integer | —              | Reuse an existing Aluvia connection ID                                                                       |
| `--disable-block-detection` | boolean | `false`        | Disable block detection entirely                                                                             |

### Success Output

```json
{
  "browserSession": "my-task",
  "pid": 12345,
  "startUrl": "https://example.com",
  "cdpUrl": "http://127.0.0.1:38209",
  "connectionId": 3449,
  "blockDetection": true,
  "autoUnblock": true
}
```

| Field            | Type           | Description                            |
| ---------------- | -------------- | -------------------------------------- |
| `browserSession` | string         | Session name                           |
| `pid`            | number         | Daemon process ID                      |
| `startUrl`       | string \| null | URL the browser navigated to           |
| `cdpUrl`         | string \| null | Chrome DevTools Protocol endpoint      |
| `connectionId`   | number \| null | Aluvia connection ID for proxy routing |
| `blockDetection` | boolean        | Whether block detection is enabled     |
| `autoUnblock`    | boolean        | Whether auto-unblock is enabled        |

### Error Outputs

**Session name already in use:**

```json
{
  "error": "A browser session named 'my-task' is already running.",
  "browserSession": "my-task",
  "startUrl": "https://example.com",
  "cdpUrl": "http://127.0.0.1:55432",
  "connectionId": 42,
  "pid": 99999
}
```

**Browser process died during startup:**

```json
{
  "browserSession": "my-task",
  "error": "Browser process exited unexpectedly.",
  "logFile": "/tmp/aluvia-sdk/cli-my-task.log"
}
```

**Startup timeout (60 seconds):**

```json
{
  "browserSession": "my-task",
  "error": "Browser is still initializing (timeout).",
  "logFile": "/tmp/aluvia-sdk/cli-my-task.log"
}
```

**Missing URL:**

```json
{ "error": "URL is required. Usage: aluvia session start <url> [options]" }
```

**Missing API key:**

```json
{ "error": "ALUVIA_API_KEY environment variable is required." }
```

### Examples

```bash
# Named session with auto-unblocking (recommended)
aluvia session start https://example.com --auto-unblock --browser-session my-task

# Run a script (session self-terminates when script finishes)
aluvia session start https://example.com --auto-unblock --run scrape.mjs --browser-session my-task

# Debug with a visible browser
aluvia session start https://example.com --headful --browser-session debug-task

# Reuse an existing connection
aluvia session start https://example.com --connection-id 3449 --browser-session my-task
```

---

## session close

Terminate one or more running browser sessions. Sends SIGTERM, waits up to 10 seconds, then force-kills with SIGKILL if needed.

```bash
aluvia session close [options]
```

### Options

| Flag                       | Type    | Description                      |
| -------------------------- | ------- | -------------------------------- |
| `--browser-session <name>` | string  | Close a specific session by name |
| `--all`                    | boolean | Close all running sessions       |

With no options, auto-selects the session if exactly one is running.

### Success Outputs

**Single session closed:**

```json
{
  "browserSession": "my-task",
  "pid": 12345,
  "message": "Browser session closed.",
  "startUrl": "https://example.com",
  "cdpUrl": "http://127.0.0.1:38209",
  "connectionId": 3449
}
```

**Force-killed (didn't respond to SIGTERM):**

```json
{
  "browserSession": "my-task",
  "pid": 12345,
  "message": "Browser session force-killed.",
  "startUrl": "https://example.com",
  "cdpUrl": "http://127.0.0.1:38209",
  "connectionId": 3449
}
```

**Already dead (stale lock cleaned up):**

```json
{
  "browserSession": "my-task",
  "message": "Browser process was not running. Lock file cleaned up."
}
```

**Close all:**

```json
{
  "message": "All browser sessions closed.",
  "closed": ["my-task", "other-task"],
  "count": 2
}
```

### Error Outputs

**No sessions running:**

```json
{ "error": "No running browser sessions found." }
```

**No sessions running (with --all):**

```json
{ "error": "No running browser sessions found.", "closed": [], "count": 0 }
```

**Multiple sessions (ambiguous — no name specified):**

```json
{
  "error": "Multiple sessions running. Specify --browser-session <name> or --all.",
  "browserSessions": ["my-task", "other-task"]
}
```

**Named session not found:**

```json
{
  "browserSession": "nonexistent",
  "error": "No running browser session found."
}
```

### Examples

```bash
aluvia session close --browser-session my-task
aluvia session close --all
aluvia session close  # auto-selects if only one session
```

---

## session list

List all active browser sessions. Automatically cleans up stale lock files (dead processes).

```bash
aluvia session list
```

No options or arguments.

### Output

```json
{
  "sessions": [
    {
      "browserSession": "my-task",
      "pid": 12345,
      "startUrl": "https://example.com",
      "cdpUrl": "http://127.0.0.1:38209",
      "connectionId": 3449,
      "blockDetection": true,
      "autoUnblock": true
    }
  ],
  "count": 1
}
```

| Field      | Type   | Description                     |
| ---------- | ------ | ------------------------------- |
| `sessions` | array  | Array of active session objects |
| `count`    | number | Number of active sessions       |

Each session object has the same fields as the `session start` success output.

---

## session get

Return full session details enriched with block detection history and the full connection object from the API.

```bash
aluvia session get [--browser-session <name>]
```

Auto-selects if only one session is running.

### Output

```json
{
  "browserSession": "my-task",
  "pid": 12345,
  "startUrl": "https://example.com",
  "cdpUrl": "http://127.0.0.1:38209",
  "connectionId": 3449,
  "blockDetection": true,
  "autoUnblock": true,
  "lastDetection": {
    "hostname": "example.com",
    "lastUrl": "https://example.com/page",
    "blockStatus": "blocked",
    "score": 0.85,
    "signals": ["http_status_403", "waf_header_cf_mitigated"],
    "pass": "fast",
    "persistentBlock": false,
    "timestamp": 1739290800000
  },
  "connection": {
    "connection_id": "3449",
    "proxy_username": "user123",
    "proxy_password": "pass456",
    "rules": ["example.com"],
    "session_id": "abc-123",
    "target_geo": "us_ca"
  }
}
```

### lastDetection fields

| Field             | Type     | Description                                              |
| ----------------- | -------- | -------------------------------------------------------- |
| `hostname`        | string   | Hostname that was analyzed                               |
| `lastUrl`         | string   | Full URL of the page                                     |
| `blockStatus`     | string   | `"blocked"`, `"suspected"`, or `"clear"`                 |
| `score`           | number   | Detection score 0.0 to 1.0                               |
| `signals`         | string[] | Signal names that fired (e.g. `"http_status_403"`)       |
| `pass`            | string   | `"fast"` or `"full"` — which analysis pass produced this |
| `persistentBlock` | boolean  | Whether this hostname is marked as persistently blocked  |
| `timestamp`       | number   | Unix timestamp in milliseconds                           |

`lastDetection` is `null` if no detection has run yet. `connection` is `null` if the API call fails (best-effort enrichment).

### Error Outputs

Same session resolution errors as other targeting commands (no sessions, multiple sessions, session not found, stale lock).

---

## session rotate-ip

Generate a new session ID to rotate the upstream IP address.

```bash
aluvia session rotate-ip [--browser-session <name>]
```

Auto-selects if only one session is running.

### Output

```json
{
  "browserSession": "my-task",
  "connectionId": 3449,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field            | Type   | Description                                                       |
| ---------------- | ------ | ----------------------------------------------------------------- |
| `browserSession` | string | Session name                                                      |
| `connectionId`   | number | Aluvia connection ID                                              |
| `sessionId`      | string | Newly generated UUID — the proxy now uses a different upstream IP |

### Error Outputs

**No connection ID:**

```json
{
  "error": "Session 'my-task' has no connection ID. It may have been started without API access."
}
```

---

## session set-geo

Set or clear geographic targeting for IP allocation.

```bash
aluvia session set-geo <geo> [--browser-session <name>]
aluvia session set-geo --clear [--browser-session <name>]
```

Either `<geo>` or `--clear` must be provided.

### Output

**Set geo:**

```json
{
  "browserSession": "my-task",
  "connectionId": 3449,
  "targetGeo": "us_ca"
}
```

**Clear geo:**

```json
{
  "browserSession": "my-task",
  "connectionId": 3449,
  "targetGeo": null
}
```

### Error Outputs

```json
{
  "error": "Geo code is required. Usage: aluvia session set-geo <geo> [--browser-session <name>]"
}
```

```json
{
  "error": "Geo code cannot be empty. Provide a valid geo code or use --clear."
}
```

### Examples

```bash
aluvia session set-geo US --browser-session my-task
aluvia session set-geo us_ca --browser-session my-task
aluvia session set-geo --clear --browser-session my-task
```

Use `aluvia geos` to list valid geo codes.

---

## session set-rules

Update hostname-based routing rules on a running session. By default appends new rules. Use `--remove` to remove specific rules.

```bash
aluvia session set-rules <rules> [--browser-session <name>]
aluvia session set-rules --remove <rules> [--browser-session <name>]
```

Rules are comma-separated. Only one mode (append or remove) per invocation.

### Behavior

- **Append (default):** Fetches current rules from the API, adds new rules (deduplicates), sends the merged list.
- **Remove (`--remove`):** Fetches current rules, filters out the specified rules, sends the remaining list.

### Rule Patterns

| Pattern         | Matches                                              |
| --------------- | ---------------------------------------------------- |
| `*`             | All hostnames (proxy everything)                     |
| `example.com`   | Exact hostname match                                 |
| `*.example.com` | All subdomains of example.com                        |
| `google.*`      | google.com, google.co.uk, etc.                       |
| `-example.com`  | Exclude from proxying (even if another rule matches) |

### Append Output

```json
{
  "browserSession": "my-task",
  "connectionId": 3449,
  "rules": ["existing.com", "new-site.com", "api.new-site.com"],
  "count": 3
}
```

### Remove Output

```json
{
  "browserSession": "my-task",
  "connectionId": 3449,
  "rules": ["existing.com"],
  "count": 1
}
```

### Error Outputs

```json
{
  "error": "Rules are required. Usage: aluvia session set-rules <rules> [--browser-session <name>]"
}
```

```json
{
  "error": "Cannot both append and remove rules. Use either <rules> or --remove <rules>, not both."
}
```

### Examples

```bash
# Add rules
aluvia session set-rules "example.com,api.example.com" --browser-session my-task

# Remove rules
aluvia session set-rules --remove "example.com" --browser-session my-task

# Wildcard subdomain matching
aluvia session set-rules "*.google.com" --browser-session my-task
```

---

## account

Display account information including balance and connection count.

```bash
aluvia account
```

### Output

```json
{
  "account": {
    "account_id": "1",
    "created_at": 1705478400,
    "aluvia_username": "user@example.com",
    "balance_gb": 84.25,
    "service": "agent_connect",
    "connection_count": 5
  }
}
```

Key field: `balance_gb` is the remaining bandwidth in gigabytes.

---

## account usage

Display usage statistics, optionally filtered by date range.

```bash
aluvia account usage [--start <ISO8601>] [--end <ISO8601>]
```

### Options

| Flag                | Type   | Description                                     |
| ------------------- | ------ | ----------------------------------------------- |
| `--start <ISO8601>` | string | Start date filter (e.g. `2025-01-01T00:00:00Z`) |
| `--end <ISO8601>`   | string | End date filter (e.g. `2025-02-01T00:00:00Z`)   |

Both are optional. Omit both for all-time usage.

### Output

```json
{
  "usage": {
    "account_id": "1",
    "start": 1705478400,
    "end": 1706083200,
    "data_used_gb": 15.75
  }
}
```

### Examples

```bash
aluvia account usage
aluvia account usage --start 2025-01-01T00:00:00Z --end 2025-02-01T00:00:00Z
```

---

## geos

List available geographic targeting options.

```bash
aluvia geos
```

### Output

```json
{
  "geos": [
    { "code": "us", "label": "United States (any)" },
    { "code": "us_ny", "label": "United States - New York" },
    { "code": "us_ca", "label": "United States - California" }
  ],
  "count": 3
}
```

Use the `code` field with `session set-geo`.

---

## help

Display help text. Plain text by default, structured JSON with `--json`.

```bash
aluvia help
aluvia help --json
aluvia --help
aluvia -h
```

The `--help` and `-h` flags work at any position (e.g. `aluvia session --help`).

### JSON Output

```json
{
  "commands": [
    {
      "command": "session start <url>",
      "description": "Start a browser session",
      "options": [
        {
          "flag": "--connection-id <id>",
          "description": "Use a specific connection ID"
        },
        { "flag": "--headful", "description": "Run browser in headful mode" },
        {
          "flag": "--browser-session <name>",
          "description": "Name for this session (auto-generated if omitted)"
        },
        {
          "flag": "--auto-unblock",
          "description": "Auto-detect blocks and reload through Aluvia"
        },
        {
          "flag": "--disable-block-detection",
          "description": "Disable block detection entirely"
        },
        {
          "flag": "--run <script>",
          "description": "Run a script with page, browser, context injected"
        }
      ]
    }
  ]
}
```

The full JSON output includes entries for all 11 commands with their options.

---

## Common Session Resolution Errors

These errors apply to any command that targets a session (`session get`, `session close`, `session rotate-ip`, `session set-geo`, `session set-rules`):

| Error                                                                            | Cause                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------- |
| `No running browser sessions found.`                                             | No active sessions exist                          |
| `Multiple sessions running. Specify --browser-session <name> or --all.`          | Multiple sessions, no name given (close only)     |
| `Multiple sessions running. Specify --browser-session <name>.`                   | Multiple sessions, no name given (other commands) |
| `No session found with name 'X'.`                                                | Named session doesn't exist                       |
| `Session 'X' is no longer running (stale lock cleaned up).`                      | Daemon process died; lock file was cleaned up     |
| `Session 'X' has no connection ID. It may have been started without API access.` | Needed for rotate-ip, set-geo, set-rules          |
