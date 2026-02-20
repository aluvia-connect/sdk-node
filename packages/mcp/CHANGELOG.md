# Changelog

All notable changes to `@aluvia/mcp` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-02-20

### Changed
- Restructured into monorepo: MCP server now in separate `@aluvia/mcp` package.
- Updated to import from `@aluvia/cli` instead of `@aluvia/sdk/cli`.

### Added
- Test script for MCP smoke testing.

## [1.0.0] - 2026-02-13

Initial release as separate package.

### Added
- MCP server implementation for Model Context Protocol integration.
- Tools for session management: `session_start`, `session_close`, `session_list`, `session_get`, `session_rotate_ip`, `session_set_geo`, `session_set_rules`.
- Tools for account management: `account_get`, `account_usage`.
- Tools for geo listing: `geos_list`.

## Previous Versions

See [SDK CHANGELOG](../sdk/CHANGELOG.md) for changes when MCP was part of SDK package.
