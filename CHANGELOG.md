# Aluvia SDK Monorepo Changelog

This repository contains three packages, each with its own changelog:

- **[@aluvia/sdk](./packages/sdk/CHANGELOG.md)** - Core SDK for Node.js
- **[@aluvia/cli](./packages/cli/CHANGELOG.md)** - Command-line tools  
- **[@aluvia/mcp](./packages/mcp/CHANGELOG.md)** - Model Context Protocol server

## Monorepo Structure - 2026-02-20

### Changed
- Restructured repository into monorepo with separate packages for SDK, CLI, and MCP.
- Root package is now private and not published to npm.
- Each package has independent versioning and changelog.

### Migration from Single Package

Previously, the SDK, CLI, and MCP were bundled together in the `@aluvia/sdk` package. As of version 1.4.1:

- **SDK functionality** → `@aluvia/sdk`
- **CLI commands** → `@aluvia/cli` (depends on SDK)
- **MCP server** → `@aluvia/mcp` (depends on SDK and CLI)

See individual package changelogs for detailed version history.

