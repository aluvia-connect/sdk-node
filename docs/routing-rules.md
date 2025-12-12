## Routing rules

Rules are evaluated **against hostnames only** (not URL paths). Patterns are case-insensitive.

### Supported patterns

- **`*`**: match any hostname
- **`example.com`**: exact match
- **`*.example.com`**: match subdomains (e.g., `foo.example.com`, `a.b.example.com`; does not match `example.com`)
- **`google.*`**: match TLD variations (e.g., `google.com`, `google.co.uk`)

### Negative rules (exclusions)

Prefix a pattern with `-` to exclude it:

- `['*', '-example.com']` proxies everything **except** `example.com`

Negative rules always win: if a hostname matches any exclusion, it will be routed direct.

### AUTO placeholder

If `AUTO` appears in the rule list, it’s treated as a placeholder and ignored.