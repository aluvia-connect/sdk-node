#!/usr/bin/env node

import { handleOpen, handleOpenDaemon } from './open.js';
import { handleClose } from './close.js';
import { handleStatus } from './status.js';
import { validateSessionName } from './lock.js';

export function output(data: Record<string, unknown>, exitCode = 0): never {
  console.log(JSON.stringify(data));
  process.exit(exitCode);
}

function parseArgs(argv: string[]): {
  command: string;
  url?: string;
  connectionId?: number;
  daemon?: boolean;
  headed?: boolean;
  sessionName?: string;
  all?: boolean;
  autoUnblock?: boolean;
} {
  const args = argv.slice(2);
  const command = args[0] ?? '';

  // Internal: --daemon mode (spawned by `open` in detached child)
  if (command === '--daemon') {
    let url: string | undefined;
    let connectionId: number | undefined;
    let headed = false;
    let sessionName: string | undefined;
    let autoUnblock = false;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--connection-id' && args[i + 1]) {
        connectionId = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i] === '--browser-session' && args[i + 1]) {
        sessionName = args[i + 1];
        i++;
      } else if (args[i] === '--headful') {
        headed = true;
      } else if (args[i] === '--auto-unblock') {
        autoUnblock = true;
      } else if (!url && !args[i].startsWith('--')) {
        url = args[i];
      }
    }

    return { command: 'open', url, connectionId, daemon: true, headed, sessionName, autoUnblock };
  }

  if (command === 'close') {
    let sessionName: string | undefined;
    let all = false;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--browser-session' && args[i + 1]) {
        sessionName = args[i + 1];
        i++;
      } else if (args[i] === '--all') {
        all = true;
      }
    }

    return { command: 'close', sessionName, all };
  }

  if (command === 'status') {
    let sessionName: string | undefined;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--browser-session' && args[i + 1]) {
        sessionName = args[i + 1];
        i++;
      }
    }

    return { command: 'status', sessionName };
  }

  if (command === 'help' || command === '--help' || command === '-h' || command === '') {
    return { command: 'help' };
  }

  if (command === 'open') {
    let url: string | undefined;
    let connectionId: number | undefined;
    let headed = false;
    let sessionName: string | undefined;
    let autoUnblock = false;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--connection-id' && args[i + 1]) {
        connectionId = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i] === '--browser-session' && args[i + 1]) {
        sessionName = args[i + 1];
        i++;
      } else if (args[i] === '--headful') {
        headed = true;
      } else if (args[i] === '--auto-unblock') {
        autoUnblock = true;
      } else if (!url && !args[i].startsWith('--')) {
        url = args[i];
      }
    }

    if (!url) {
      output(
        {
          status: 'error',
          error: 'URL is required. Usage: npx aluvia-sdk open <url> [--connection-id <id>] [--browser-session <name>]',
        },
        1,
      );
    }

    return { command: 'open', url, connectionId, headed, sessionName, autoUnblock };
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
  log('  npx aluvia-sdk open <url> [options]    Start a browser session');
  log('  npx aluvia-sdk close [options]          Stop a browser session');
  log('  npx aluvia-sdk status [options]         Show browser session status');
  log('  npx aluvia-sdk help                     Show this help\n');
  log('Open options:');
  log('  --connection-id <id>       Use a specific connection ID');
  log('  --headful                  Run browser in headful mode');
  log('  --browser-session <name>   Name for this session (auto-generated if omitted)');
  log('  --auto-unblock             Auto-detect blocks and reload through Aluvia\n');
  log('Close options:');
  log('  --browser-session <name>   Close a specific session');
  log('  --all                      Close all sessions\n');
  log('Status options:');
  log('  --browser-session <name>   Show status for a specific session\n');
  log('Environment:');
  log('  ALUVIA_API_KEY   Required. Your Aluvia API key.\n');
  log('Output:');
  log('  All commands output JSON to stdout for machine consumption.');
}

async function main(): Promise<void> {
  const { command, url, connectionId, daemon, headed, sessionName, all, autoUnblock } = parseArgs(process.argv);

  // Validate session name if provided
  if (sessionName && !validateSessionName(sessionName)) {
    output(
      { status: 'error', error: 'Invalid session name. Use only letters, numbers, hyphens, and underscores.' },
      1,
    );
  }

  if (command === 'help') {
    printHelp();
    process.exit(0);
  } else if (command === 'open') {
    if (daemon) {
      await handleOpenDaemon({ url: url!, connectionId, headless: !headed, sessionName, autoUnblock });
    } else {
      handleOpen({ url: url!, connectionId, headless: !headed, sessionName, autoUnblock });
    }
  } else if (command === 'close') {
    await handleClose(sessionName, all);
  } else if (command === 'status') {
    handleStatus(sessionName);
  }
}

main().catch((err) => {
  output({ status: 'error', error: err.message }, 1);
});
