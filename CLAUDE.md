# Aluvia SDK for Node.js

## Commands

- `npm run build` — Dual ESM/CJS build (tsconfig.esm.json + tsconfig.cjs.json, adds CJS package.json shim)
- `npm test` — Integration tests via Node.js native test runner (`node --import tsx --test`)
- `npm run lint` — Check formatting (Prettier)
- `npm run lint:fix` — Auto-fix formatting

## Architecture

```
src/
  index.ts          — Public API exports
  connect.ts        — CDP connect helper (requires Playwright peer dep)
  errors.ts         — Custom error hierarchy
  api/              — REST API client (AluviaApi, account, geos)
  client/           — Core proxy client (AluviaClient, ProxyServer, ConfigManager, BlockDetection, adapters)
  session/          — Session lock file management
  bin/              — CLI entrypoint and subcommands (aluvia / aluvia-sdk)
test/               — Integration tests (node:test + node:assert)
docs/               — Technical guides (API, CLI, client)
```

## Key Patterns

- **Dual-build output**: ESM to `dist/esm/`, CJS to `dist/cjs/`, types to `dist/types/`. CJS build emits declarations.
- **ESM-first**: Source uses `.js` extensions in imports (required for ESM resolution). Package is `"type": "module"`.
- **Node.js native test runner**: Tests use `node:test` and `node:assert`, NOT Jest/Mocha. Run via tsx loader.
- **Adapters pattern**: `client/adapters.ts` provides framework-specific proxy configs (`asPlaywright()`, `asPuppeteer()`, `asAxiosConfig()`, etc.).
- **Error classes use `Object.setPrototypeOf`**: Required for proper `instanceof` checks with TypeScript class inheritance.

## Gotchas

- **Playwright is an optional peer dep** — not installed by default. `connect()` and `startPlaywright` throw helpful errors if missing.
- **Tests import from `src/` directly** (not `dist/`) — `tsx` loader compiles on the fly. No build step needed before testing.
- **The base `tsconfig.json` includes both `src/` and `test/`** — it's used for IDE support. The actual builds use `tsconfig.esm.json` and `tsconfig.cjs.json` which only include `src/`.
- **CLI outputs JSON to stdout** — all commands use the `output()` helper. Human-readable help goes to stderr/stdout but structured data is always JSON.
- **`.env` contains `ALUVIA_API_KEY`** — never commit `.env`, only `.env.example`.
