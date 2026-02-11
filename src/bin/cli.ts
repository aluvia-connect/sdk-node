#!/usr/bin/env node

// Aluvia SDK CLI
// Usage:
//   npx @aluvia/sdk open <url> [--connection-id <id>]
//   npx @aluvia/sdk close
//
// All output is JSON for machine consumption.

import { handleOpen, handleOpenDaemon } from './open.js';
import { handleClose } from './close.js';
import { removeLock } from './lock.js';

/** Helper to print a JSON result and exit. */
export function output(data: Record<string, unknown>, exitCode = 0): never {
  console.log(JSON.stringify(data));
  process.exit(exitCode);
}

function parseArgs(argv: string[]): {
  command: string;
  url?: string;
  connectionId?: number;
  daemon?: boolean;
} {
  const args = argv.slice(2);
  const command = args[0] ?? '';

  // Internal: --daemon mode (spawned by `open` in detached child)
  if (command === '--daemon') {
    let url: string | undefined;
    let connectionId: number | undefined;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--connection-id' && args[i + 1]) {
        connectionId = parseInt(args[i + 1], 10);
        i++;
      } else if (!url && !args[i].startsWith('--')) {
        url = args[i];
      }
    }

    return { command: 'open', url, connectionId, daemon: true };
  }

  if (command === 'close') {
    return { command: 'close' };
  }

  if (command === 'open') {
    let url: string | undefined;
    let connectionId: number | undefined;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--connection-id' && args[i + 1]) {
        connectionId = parseInt(args[i + 1], 10);
        i++;
      } else if (!url && !args[i].startsWith('--')) {
        url = args[i];
      }
    }

    if (!url) {
      output(
        {
          status: 'error',
          error: 'URL is required. Usage: npx @aluvia/sdk open <url> [--connection-id <id>]',
        },
        1,
      );
    }

    return { command: 'open', url, connectionId };
  }

  // Unknown or missing command
  output(
    {
      status: 'error',
      error: 'Unknown command.',
      usage: {
        open: 'npx @aluvia/sdk open <url> [--connection-id <id>]',
        close: 'npx @aluvia/sdk close',
      },
      env: { ALUVIA_API_KEY: 'Required. Your Aluvia API key.' },
    },
    1,
  );
}

async function main(): Promise<void> {
  const { command, url, connectionId, daemon } = parseArgs(process.argv);

  if (command === 'open') {
    if (daemon) {
      await handleOpenDaemon(url!, connectionId);
    } else {
      handleOpen(url!, connectionId);
    }
  } else if (command === 'close') {
    await handleClose();
  }
}

main().catch((err) => {
  output({ status: 'error', error: err.message }, 1);
  removeLock();
});
