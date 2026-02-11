#!/usr/bin/env node

// Aluvia SDK CLI
// Usage:
//   npx @aluvia/sdk open <url> [--connection-id <id>]
//   npx @aluvia/sdk close

import { Logger } from '../client/logger.js';
import { handleOpen, handleOpenDaemon } from './open.js';
import { handleClose } from './close.js';
import { removeLock } from './lock.js';

function parseArgs(argv: string[]): {
  command: string;
  url?: string;
  connectionId?: number;
  daemon?: boolean;
} {
  // argv[0] = node, argv[1] = script
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
        i++; // skip next
      } else if (!url && !args[i].startsWith('--')) {
        url = args[i];
      }
    }

    if (!url) {
      console.error('Error: URL is required for the open command.');
      console.error('Usage: npx @aluvia/sdk open <url> [--connection-id <id>]');
      process.exit(1);
    }

    return { command: 'open', url, connectionId };
  }

  // Unknown or missing command
  console.error('Aluvia SDK CLI');
  console.error('');
  console.error('Usage:');
  console.error('  npx @aluvia/sdk open <url> [--connection-id <id>]   Open a browser');
  console.error('  npx @aluvia/sdk close                               Close the running browser');
  console.error('');
  console.error('Environment:');
  console.error('  ALUVIA_API_KEY   Required. Your Aluvia API key.');
  process.exit(1);
}

async function main(): Promise<void> {
  const { command, url, connectionId, daemon } = parseArgs(process.argv);
  const logger = new Logger('info');

  if (command === 'open') {
    if (daemon) {
      // Running as detached daemon — actually start the browser
      await handleOpenDaemon(url!, connectionId, logger);
    } else {
      // Foreground — spawn daemon and print session info
      handleOpen(url!, connectionId, logger);
    }
  } else if (command === 'close') {
    await handleClose(logger);
  }
}

main().catch((err) => {
  console.error(`[aluvia][error] ${err.message}`);
  removeLock();
  process.exit(1);
});
