# Aluvia CLI Workflow Recipes

Step-by-step patterns for common scenarios. Each workflow shows the exact commands and how to handle the JSON output.

---

## 1. Simple Scrape with Auto-Unblock

The 80% case: start a session, let Aluvia handle blocks, close when done.

```bash
# Start session with auto-unblock
aluvia session start https://target-site.com --auto-unblock --browser-session scrape-task
# Output: {"browserSession":"scrape-task","pid":12345,"startUrl":"https://target-site.com","cdpUrl":"http://127.0.0.1:38209","connectionId":3449,"blockDetection":true,"autoUnblock":true}

# Your agent interacts with the browser via CDP or connect()...
# Auto-unblock handles 403s, WAFs, and CAPTCHAs automatically.

# Check if blocks occurred
aluvia session get --browser-session scrape-task
# Inspect lastDetection.blockStatus — "clear" means no issues

# Close when done
aluvia session close --browser-session scrape-task
```

**When to use:** Any single-site scraping task. The SDK detects blocks, adds the hostname to proxy rules, and reloads the page without agent intervention.

---

## 2. Multi-Domain Rule Expansion

When your agent discovers new domains during browsing that also need proxying.

```bash
# Start with the primary domain
aluvia session start https://main-site.com --auto-unblock --browser-session multi-domain

# Agent navigates and discovers API calls going to api.main-site.com and cdn.partner.com
# Add those domains to routing rules
aluvia session set-rules "api.main-site.com,cdn.partner.com" --browser-session multi-domain
# Output: {"browserSession":"multi-domain","connectionId":3449,"rules":["main-site.com","api.main-site.com","cdn.partner.com"],"count":3}

# Agent discovers another blocked domain
aluvia session set-rules "auth.partner.com" --browser-session multi-domain
# Rules accumulate — now 4 rules total

# If a domain no longer needs proxying, remove it
aluvia session set-rules --remove "cdn.partner.com" --browser-session multi-domain

# Close when done
aluvia session close --browser-session multi-domain
```

**When to use:** Multi-page crawls where the agent discovers subdomains or third-party domains that need proxy routing.

---

## 3. Persistent Block Recovery

When `--auto-unblock` isn't enough and you need to escalate manually.

```bash
# Start session
aluvia session start https://tough-site.com --auto-unblock --browser-session recovery-task

# Check detection status
aluvia session get --browser-session recovery-task
# If lastDetection.blockStatus is "blocked" and persistentBlock is true,
# auto-unblock has already tried and given up. Escalate:

# Step 1: Rotate IP (try up to 3 times)
aluvia session rotate-ip --browser-session recovery-task
# Output: {"browserSession":"recovery-task","connectionId":3449,"sessionId":"<new-uuid>"}

# Agent reloads the page and checks again...

# Step 2: If still blocked after 3 rotations, try geo-targeting
aluvia session set-geo us_ca --browser-session recovery-task
aluvia session rotate-ip --browser-session recovery-task
# Agent reloads and checks...

# Step 3: Try a different geo
aluvia session set-geo us_ny --browser-session recovery-task
aluvia session rotate-ip --browser-session recovery-task

# Step 4: If still blocked after all attempts, report failure
# Do NOT keep retrying — the site likely uses fingerprinting beyond IP

# Always close
aluvia session close --browser-session recovery-task
```

**Escalation ladder:**

1. Let `--auto-unblock` handle it (automatic)
2. Rotate IP (up to 3 times)
3. Rotate IP + change geo
4. Stop and report — further retries waste bandwidth

---

## 4. Geo-Targeted Data Collection

Collect region-specific content by targeting IPs from different US states.

```bash
# List available geos
aluvia geos
# Output: {"geos":[{"code":"us","label":"United States (any)"},{"code":"us_ca","label":"United States - California"},{"code":"us_ny","label":"United States - New York"}...],"count":...}

# Start a session targeting California
aluvia session start https://store.example.com --auto-unblock --browser-session geo-task
aluvia session set-geo us_ca --browser-session geo-task
# Agent collects California-specific pricing...

# Switch to New York
aluvia session set-geo us_ny --browser-session geo-task
aluvia session rotate-ip --browser-session geo-task
# Agent reloads and collects New York-specific pricing...

# Clear geo to go back to any US IP
aluvia session set-geo --clear --browser-session geo-task

# Close when done
aluvia session close --browser-session geo-task
```

**When to use:** Price comparison, regional content audits, or verifying geo-restricted content.

---

## 5. Script Execution with --run

One-shot automation where the session self-terminates after the script finishes.

```bash
# Write your script (page, browser, context are available as globals)
# scrape.mjs:
#   const title = await page.title();
#   const data = await page.evaluate(() => document.body.innerText);
#   console.log(JSON.stringify({title, data}));

# Run it — session starts, runs script, and exits automatically
aluvia session start https://example.com --auto-unblock --run scrape.mjs --browser-session one-shot
```

**Key behavior:**

- The session starts, navigates to the URL, then runs your script.
- `page`, `browser`, and `context` are Playwright objects injected as globals — no imports needed.
- When the script finishes (or throws), the session cleans up and exits.
- Exit code 0 on success, 1 on script error.
- Script output goes to the daemon log file, not to the CLI's stdout.
- You do **not** need to call `session close` — the session self-terminates.

**When to use:** Simple, self-contained scraping tasks that don't need ongoing session management.

---

## 6. Budget Monitoring

Check remaining bandwidth before and during expensive operations.

```bash
# Check balance before starting
aluvia account
# Output: {"account":{"account_id":"1","balance_gb":84.25,...}}
# If balance_gb is low, warn the user before proceeding

# Check usage for a specific period
aluvia account usage --start 2025-01-01T00:00:00Z --end 2025-02-01T00:00:00Z
# Output: {"usage":{"account_id":"1","start":1705478400,"end":1706083200,"data_used_gb":15.75}}

# During a long task, periodically check balance
aluvia account
# If balance drops below a threshold, stop and report
```

**Rules of thumb:**

- Check `balance_gb` before tasks expected to transfer significant data.
- If balance is below 1 GB, warn the user before starting heavy operations.
- For long-running tasks, check balance periodically.

---

## 7. Error Recovery and Cleanup

The always-close-sessions pattern for robust error handling.

```bash
# Start session
aluvia session start https://example.com --auto-unblock --browser-session safe-task

# If the start command returns exit code 1, parse the error:
# - "already running" → the session exists, reuse it or close and restart
# - "ALUVIA_API_KEY environment variable is required." → stop, ask user for key
# - "Browser process exited unexpectedly." → check logFile, retry once

# During operation, if any command fails:
# 1. Parse the error JSON
# 2. Attempt recovery (rotate IP, set rules, etc.)
# 3. If recovery fails, always close the session before stopping

# Cleanup: ensure the session is closed regardless of outcome
aluvia session close --browser-session safe-task

# If you're unsure whether the session exists (e.g., after an error during start):
aluvia session list
# Check if your session appears in the list, then close it if it does

# Nuclear option: close everything (use sparingly)
aluvia session close --all
```

**Error response pattern:**
Every error returns `{"error": "message"}` with exit code 1. Some errors include extra context fields (`browserSession`, `pid`, `logFile`, `browserSessions`). Always parse the JSON — never assume the shape.

**Session name conflicts:**
If `session start` returns "already running", the response includes `pid`, `cdpUrl`, and `connectionId` of the existing session. You can either use that session or close it first.
