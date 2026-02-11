import { AluviaClient } from '../client/AluviaClient.js';
import { writeLock, readLock, removeLock, isProcessAlive, getLogFilePath } from './lock.js';
import { output } from './cli.js';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

export type OpenOptions = {
  url: string;
  connectionId?: number;
  headless?: boolean;
};

/**
 * Called from cli.ts when running `open <url>`.
 * Spawns the actual browser in a detached child and returns immediately.
 */
export function handleOpen({ url, connectionId, headless }: OpenOptions): void {
  // Check for existing instance
  const existing = readLock();
  if (existing !== null && isProcessAlive(existing.pid)) {
    output(
      {
        status: 'error',
        error: 'A browser session is already running.',
        url: existing.url ?? null,
        cdpUrl: existing.cdpUrl ?? null,
        connectionId: existing.connectionId ?? null,
        pid: existing.pid,
      },
      1,
    );
  }

  // Clean up stale lock if process is dead
  if (existing !== null) {
    removeLock();
  }

  // Require API key
  const apiKey = process.env.ALUVIA_API_KEY;
  if (!apiKey) {
    output({ status: 'error', error: 'ALUVIA_API_KEY environment variable is required.' }, 1);
  }

  // Spawn a detached child process that runs the daemon
  const logFile = getLogFilePath();
  const out = fs.openSync(logFile, 'a');

  const args = ['--daemon', url];
  if (connectionId != null) {
    args.push('--connection-id', String(connectionId));
  }
  if (!headless) {
    args.push('--headed');
  }

  const child = spawn(process.execPath, [process.argv[1], ...args], {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, ALUVIA_API_KEY: apiKey },
  });

  child.unref();
  fs.closeSync(out);

  // Wait for the daemon to be fully ready (lock file with ready: true)
  let attempts = 0;
  const maxAttempts = 240; // 60 seconds max
  const poll = setInterval(() => {
    attempts++;
    const lock = readLock();
    if (lock && lock.ready) {
      clearInterval(poll);
      output({
        status: 'ok',
        url: lock.url ?? null,
        cdpUrl: lock.cdpUrl ?? null,
        connectionId: lock.connectionId ?? null,
        pid: lock.pid,
      });
    }
    if (attempts >= maxAttempts) {
      clearInterval(poll);
      const alive = child.pid ? isProcessAlive(child.pid) : false;
      output(
        {
          status: 'error',
          error: alive ? 'Browser is still initializing (timeout).' : 'Browser process exited unexpectedly.',
          logFile,
        },
        1,
      );
    }
  }, 250);
}

/**
 * Daemon entry point — runs in the detached child process.
 * Starts the proxy + browser, writes lock, and stays alive.
 * Logs go to the daemon log file (stdout is redirected), not to the user.
 */
export async function handleOpenDaemon({ url, connectionId, headless }: OpenOptions): Promise<void> {
  const apiKey = process.env.ALUVIA_API_KEY!;

  const client = new AluviaClient({
    apiKey,
    startPlaywright: true,
    localProxy: true,
    ...(connectionId != null ? { connectionId } : {}),
    headless: headless ?? true,
  });

  const connection = await client.start();

  // Write early lock so parent knows daemon is alive
  writeLock({ pid: process.pid, url });

  console.log(`[daemon] Browser initialized — proxy: ${connection.url}`);
  if (connection.cdpUrl) console.log(`[daemon] CDP URL: ${connection.cdpUrl}`);
  if (connectionId) console.log(`[daemon] Connection ID: ${connectionId}`);
  console.log(`[daemon] Opening ${url}`);

  // Navigate to URL in the browser
  const page = await connection.browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Gather session info
  const pageTitle = await page.title().catch(() => '');
  const cdpUrl = connection.cdpUrl ?? '';

  // Get connection ID: use the one passed in, or fetch the latest from API
  let connId: number | undefined = connectionId;
  if (connId == null) {
    try {
      const connections = await client.api.account.connections.list();
      if (connections.length > 0) {
        const latest = connections[connections.length - 1];
        connId = Number(latest.connection_id ?? latest.id);
      }
    } catch {
      // ignore — connection ID is nice-to-have
    }
  }

  // Write lock file with full session metadata (marks session as ready)
  writeLock({
    pid: process.pid,
    connectionId: connId,
    cdpUrl,
    url,
    ready: true,
  });

  console.log(
    `[daemon] Session ready — url: ${url}, cdpUrl: ${cdpUrl}, connectionId: ${connId ?? 'unknown'}, pid: ${process.pid}`,
  );
  if (pageTitle) console.log(`[daemon] Page title: ${pageTitle}`);

  // Graceful shutdown handler
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log('[daemon] Shutting down...');
    try {
      await connection.close();
    } catch {
      // ignore
    }
    removeLock();
    console.log('[daemon] Stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Detect when the browser is closed by the user
  if (connection.browser) {
    connection.browser.on('disconnected', () => {
      if (!stopping) {
        console.log('[daemon] Browser closed by user.');
        removeLock();
        client
          .stop()
          .catch(() => {})
          .finally(() => process.exit(0));
      }
    });
  }
}
