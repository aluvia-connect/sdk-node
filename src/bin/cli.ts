#!/usr/bin/env node

import { handleOpen, handleOpenDaemon } from './open.js';
import { handleClose } from './close.js';
import { removeLock } from './lock.js';

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

  if (command === 'help' || command === '--help' || command === '-h' || command === '') {
    return { command: 'help' };
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

  // Unknown command — show help to stderr
  if (command) {
    console.error(`Unknown command: '${command}'\n`);
  }
  printHelp(true);
  process.exit(1);
}

function printHelp(toStderr = false): void {
  const log = toStderr ? console.error : console.log;
  log('Aluvia SDK CLI\n');
  log('Usage:');
  log('  npx @aluvia/sdk open <url> [--connection-id <id>]   Start a browser session');
  log('  npx @aluvia/sdk close                               Stop the running browser session');
  log('  npx @aluvia/sdk help                                Show this help\n');
  log('Environment:');
  log('  ALUVIA_API_KEY   Required. Your Aluvia API key.\n');
  log('Output:');
  log('  All commands output JSON to stdout for machine consumption.');
}

async function main(): Promise<void> {
  const { command, url, connectionId, daemon } = parseArgs(process.argv);

  if (command === 'help') {
    printHelp();
    process.exit(0);
  } else if (command === 'open') {
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
