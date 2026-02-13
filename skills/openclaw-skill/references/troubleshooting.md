# Aluvia CLI Troubleshooting

Error messages, block detection interpretation, signal reference, and recovery steps.

---

## Error Message Reference

### Environment Errors

| Error                                                           | Cause                           | Resolution                                                                  |
| --------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `ALUVIA_API_KEY environment variable is required.`              | API key not set                 | Set the env var: `export ALUVIA_API_KEY="..."`                              |
| `Unknown command: 'X'. Run "aluvia help" for usage.`            | Unrecognized command            | Check spelling. Run `aluvia help --json` for valid commands.                |
| `Unknown session subcommand: 'X'. Run "aluvia help" for usage.` | Unrecognized session subcommand | Valid: `start`, `close`, `list`, `get`, `rotate-ip`, `set-geo`, `set-rules` |
| `Unknown account subcommand: 'X'.`                              | Unrecognized account subcommand | Valid: `usage` (or omit for account info)                                   |

### Session Start Errors

| Error                                                                        | Cause                                     | Resolution                                                                                                                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `URL is required. Usage: aluvia session start <url> [options]`               | Missing URL argument                      | Provide a URL as the first argument                                                                                                                     |
| `Invalid --connection-id: 'X' must be a positive integer.`                   | Bad connection ID value                   | Use a positive integer                                                                                                                                  |
| `Invalid session name. Use only letters, numbers, hyphens, and underscores.` | Invalid characters in `--browser-session` | Names must match `[a-zA-Z0-9_-]+`                                                                                                                       |
| `A browser session named 'X' is already running.`                            | Session name conflict                     | Use a different name, or close the existing session first. The error response includes `pid`, `cdpUrl`, and `connectionId` of the existing session.     |
| `Browser process exited unexpectedly.`                                       | Chromium crashed during startup           | Check the `logFile` path in the error response for details. Common causes: missing Playwright browsers (`npx playwright install`), insufficient memory. |
| `Browser is still initializing (timeout).`                                   | Startup took > 60 seconds                 | Check the `logFile`. Slow network or heavy page load. Retry or try a simpler URL.                                                                       |

### Session Targeting Errors

These errors appear on `session close`, `session get`, `session rotate-ip`, `session set-geo`, `session set-rules`:

| Error                                                                            | Cause                               | Resolution                                                                                  |
| -------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `No running browser sessions found.`                                             | No active sessions                  | Start a session first with `session start`                                                  |
| `Multiple sessions running. Specify --browser-session <name> or --all.`          | Ambiguous target (close)            | Pass `--browser-session <name>` or `--all`                                                  |
| `Multiple sessions running. Specify --browser-session <name>.`                   | Ambiguous target (other commands)   | Pass `--browser-session <name>`                                                             |
| `No session found with name 'X'.`                                                | Named session doesn't exist         | Run `session list` to see active sessions                                                   |
| `Session 'X' is no longer running (stale lock cleaned up).`                      | Daemon process died                 | The lock file was cleaned up. Start a new session.                                          |
| `Session 'X' has no connection ID. It may have been started without API access.` | No connection ID for API operations | Required for `rotate-ip`, `set-geo`, `set-rules`. Restart the session with a valid API key. |

### Set-Geo Errors

| Error                                                                                  | Cause                            | Resolution                          |
| -------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------- |
| `Geo code is required. Usage: aluvia session set-geo <geo> [--browser-session <name>]` | No geo argument and no `--clear` | Provide a geo code or use `--clear` |
| `Geo code cannot be empty. Provide a valid geo code or use --clear.`                   | Empty string geo                 | Use a valid code from `aluvia geos` |

### Set-Rules Errors

| Error                                                                                    | Cause             | Resolution                    |
| ---------------------------------------------------------------------------------------- | ----------------- | ----------------------------- |
| `Rules are required. Usage: aluvia session set-rules <rules> [--browser-session <name>]` | No rules provided | Provide comma-separated rules |
| `Cannot both append and remove rules. Use either <rules> or --remove <rules>, not both.` | Both modes used   | Use one mode per invocation   |

---

## Block Detection Score Interpretation

Block detection scores each page load from 0.0 to 1.0 using weighted signals.

| Score Range | Block Status  | Meaning                             | Auto-Unblock Behavior                             |
| ----------- | ------------- | ----------------------------------- | ------------------------------------------------- |
| >= 0.7      | `"blocked"`   | High confidence the page is blocked | Adds hostname to rules and reloads                |
| >= 0.4      | `"suspected"` | Possible block, uncertain           | No action (unless `autoUnblockOnSuspected` is on) |
| < 0.4       | `"clear"`     | No block detected                   | No action                                         |

Scores use probabilistic combination: `score = 1 - product(1 - weight)`. This means weak signals don't stack into false positives.

### Reading `lastDetection` in `session get`

```json
{
  "lastDetection": {
    "hostname": "example.com",
    "lastUrl": "https://example.com/page",
    "blockStatus": "blocked",
    "score": 0.85,
    "signals": ["http_status_403", "waf_header_cf_mitigated"],
    "pass": "fast",
    "persistentBlock": false,
    "timestamp": 1739290800000
  }
}
```

- **`blockStatus`**: The summary — check this first.
- **`score`**: The numeric confidence. Higher = more certain it's blocked.
- **`signals`**: Which detectors fired. Use this to understand _why_ it's blocked.
- **`pass`**: `"fast"` = detected from HTTP headers alone (high confidence). `"full"` = detected after DOM analysis.
- **`persistentBlock`**: `true` means the SDK already tried to unblock this hostname and failed. Auto-unblock will not retry.
- **`timestamp`**: Unix milliseconds. Compare against current time to know how recent the detection is.
- **`null`**: If `lastDetection` is null, no page has been analyzed yet.

---

## Signal Names Reference

These are the signal names that appear in the `signals` array of `lastDetection`.

### High-Confidence Signals (weight >= 0.7)

| Signal                    | Weight | What It Means                                                                           |
| ------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `waf_header_cf_mitigated` | 0.9    | Cloudflare sent `cf-mitigated: challenge` header. The page is a Cloudflare challenge.   |
| `http_status_403`         | 0.85   | Server returned 403 Forbidden. Classic bot block response.                              |
| `http_status_429`         | 0.85   | Server returned 429 Too Many Requests. Rate limited.                                    |
| `challenge_selector`      | 0.8    | CAPTCHA or WAF challenge DOM elements found (reCAPTCHA, hCaptcha, PerimeterX, etc.).    |
| `title_keyword`           | 0.8    | Page title contains block keywords ("Access Denied", "Blocked", "Please verify", etc.). |
| `redirect_to_challenge`   | 0.7    | Redirect chain goes through a known challenge domain.                                   |

### Medium-Confidence Signals (weight 0.4-0.69)

| Signal                        | Weight | What It Means                                                               |
| ----------------------------- | ------ | --------------------------------------------------------------------------- |
| `meta_refresh_challenge`      | 0.65   | A `<meta http-equiv="refresh">` tag points to a challenge URL.              |
| `http_status_503`             | 0.6    | Server returned 503 Service Unavailable. May be a block or actual downtime. |
| `visible_text_keyword_strong` | 0.6    | High-confidence block keywords found in visible text on a short page.       |

### Low-Confidence Signals (weight < 0.4)

| Signal                      | Weight | What It Means                                                                                          |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `visible_text_short`        | 0.2    | Page has fewer than 50 characters of visible text. Possible block page.                                |
| `low_text_ratio`            | 0.2    | Text-to-HTML ratio below 3% on pages >= 1000 bytes. Suggests boilerplate block page.                   |
| `visible_text_keyword_weak` | 0.15   | Low-confidence keywords found with word-boundary matching.                                             |
| `waf_header_cloudflare`     | 0.1    | `server: cloudflare` header present. Not a block by itself — just indicates Cloudflare is in the path. |

### How Signals Combine

Signals combine probabilistically, not additively. Example:

- `http_status_403` (0.85) alone = score 0.85 = **blocked**
- `waf_header_cloudflare` (0.1) alone = score 0.1 = **clear**
- `waf_header_cloudflare` (0.1) + `visible_text_short` (0.2) = score 0.28 = **clear** (weak signals stay weak)
- `http_status_403` (0.85) + `waf_header_cf_mitigated` (0.9) = score 0.985 = **blocked** (strong signals reinforce)

---

## Common Failure Patterns

### Pattern: Session starts but page loads blank

**Symptoms:** `session start` succeeds, but the page content is empty or minimal.

**Check:**

1. Run `session get` and look at `lastDetection`.
2. If `blockStatus` is `"blocked"` with `persistentBlock: true`, auto-unblock already tried and failed.
3. Escalate: rotate IP, then try geo-targeting. See the Persistent Block Recovery workflow.

### Pattern: "already running" on start

**Symptoms:** `session start` returns error with the existing session's details.

**Fix:**

- Close the existing session: `aluvia session close --browser-session <name>`
- Or reuse it — the error response includes `cdpUrl` for connecting.

### Pattern: Commands fail with "no connection ID"

**Symptoms:** `rotate-ip`, `set-geo`, or `set-rules` returns "has no connection ID".

**Cause:** The session was started without a valid API key or the API was unreachable during startup.

**Fix:** Close the session and restart with a valid `ALUVIA_API_KEY`.

### Pattern: Stale session after system restart

**Symptoms:** `session list` shows sessions but commands fail with "no longer running".

**Cause:** The daemon processes died (e.g., system reboot) but lock files remain.

**Fix:** The CLI automatically cleans up stale locks when you run targeting commands. You can also run `session close --all` to clean up all stale locks.

### Pattern: High bandwidth usage

**Symptoms:** `account` shows low `balance_gb` or `account usage` shows unexpected consumption.

**Check:**

1. Are routing rules too broad? Using `*` (proxy all) routes everything through Aluvia. Use specific hostnames instead.
2. Are sessions left running? Run `session list` and close unused sessions.
3. Is the agent loading heavy pages (images, video)? Consider blocking media in Playwright.

### Pattern: Blocks persist after IP rotation

**Symptoms:** Site still blocks after 3 IP rotations.

**Possible causes:**

- Site uses browser fingerprinting beyond IP address
- Site uses cookie-based blocking (clear cookies between rotations)
- Site has allowlisted only specific IP ranges

**Resolution:** Stop retrying. Report to the user that the site uses advanced anti-bot measures beyond IP-based blocking.
