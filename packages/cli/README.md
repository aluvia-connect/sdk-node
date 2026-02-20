# @aluvia/cli

Command-line interface for Aluvia - launch and manage browser sessions with automatic unblocking.

## Installation

```bash
npm install -g @aluvia/cli
```

## Usage

```bash
# Launch a browser session with auto-unblocking
aluvia session start https://example.com --auto-unblock

# Run a script with the session
aluvia session start https://example.com --auto-unblock --run script.mjs

# Show account info
aluvia account

# List available geos
aluvia geos
```

## Commands

- `aluvia session start <url> [options]` - Start a browser session
- `aluvia session close [options]` - Stop a browser session
- `aluvia session list` - List active browser sessions
- `aluvia session get [options]` - Get session details and proxy URLs
- `aluvia session rotate-ip [options]` - Rotate IP on a running session
- `aluvia session set-geo <geo> [options]` - Set target geo
- `aluvia session set-rules <rules> [options]` - Set routing rules
- `aluvia account` - Show account info
- `aluvia account usage [options]` - Show usage stats
- `aluvia geos` - List available geos
- `aluvia help [--json]` - Show help

## Documentation

See the [main repository](https://github.com/aluvia-connect/sdk-node) for complete documentation.

## License

MIT
