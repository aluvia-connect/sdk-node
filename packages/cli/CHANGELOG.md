# Changelog

All notable changes to `@aluvia/cli` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2026-02-20

### Changed
- Restructured into monorepo: CLI extracted from SDK into separate `@aluvia/cli` package.
- CLI now depends on `@aluvia/sdk` package for core functionality.
- Removed `aluvia-sdk` binary alias, only `aluvia` command is available.

### Added
- Programmatic exports via `@aluvia/cli` for MCP and other integrations.
- `captureOutput()` helper for capturing CLI output in non-CLI contexts.

## Previous Versions

See [SDK CHANGELOG](../sdk/CHANGELOG.md) for changes prior to monorepo restructure.
