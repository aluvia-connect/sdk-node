// CLI open command — start proxy + browser and navigate to URL
//
// When called without --daemon, spawns a detached child process with --daemon
// so the browser survives terminal close. The parent prints session info and exits.

import { AluviaClient } from '../client/AluviaClient.js';
import { Logger } from '../client/logger.js';
import { writeLock, readLock, removeLock, isProcessAlive, getLogFilePath } from './lock.js';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

/**
 * Called from cli.ts when running `open <url>`.
 * Spawns the actual browser in a detached child and returns immediately.
 */
export function handleOpen(url: string, connectionId: number | undefined, logger: Logger): void {
  // Check for existing instance
  const existing = readLock();
  if (existing !== null && isProcessAlive(existing.pid)) {
    logger.error(`A browser session is already running (PID ${existing.pid}).`);
    if (existing.url) logger.error(`  URL: ${existing.url}`);
    if (existing.connectionId) logger.error(`  Connection ID: ${existing.connectionId}`);
    logger.error("Run 'npx @aluvia/sdk close' first.");
    process.exit(1);
  }

  // Clean up stale lock if process is dead
  if (existing !== null) {
    removeLock();
  }

  // Require API key
  const apiKey = process.env.ALUVIA_API_KEY;
  if (!apiKey) {
    logger.error('ALUVIA_API_KEY environment variable is required.');
    process.exit(1);
  }

  logger.info('Starting Aluvia proxy and browser...');

  // Spawn a detached child process that runs the daemon
  const logFile = getLogFilePath();
  const out = fs.openSync(logFile, 'a');

  const args = ['--daemon', url];
  if (connectionId != null) {
    args.push('--connection-id', String(connectionId));
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
      logger.info('Browser session started successfully!');
      logger.info(`  PID:           ${lock.pid}`);
      if (lock.connectionId) logger.info(`  Connection ID: ${lock.connectionId}`);
      if (lock.cdpUrl) logger.info(`  CDP URL:       ${lock.cdpUrl}`);
      if (lock.url) logger.info(`  URL:           ${lock.url}`);
      logger.info('');
      logger.info("Run 'npx @aluvia/sdk close' to stop the browser.");
      process.exit(0);
    }
    if (attempts >= maxAttempts) {
      clearInterval(poll);
      // Check if child is still alive
      if (child.pid && isProcessAlive(child.pid)) {
        logger.info('Browser is starting (still initializing). Check log: ' + logFile);
      } else {
        logger.error('Browser process exited unexpectedly. Check log: ' + logFile);
      }
      process.exit(1);
    }
  }, 250);
}

/**
 * Daemon entry point — runs in the detached child process.
 * Starts the proxy + browser, writes lock, and stays alive.
 */
export async function handleOpenDaemon(
  url: string,
  connectionId: number | undefined,
  logger: Logger,
): Promise<void> {
  const apiKey = process.env.ALUVIA_API_KEY!;

  const client = new AluviaClient({
    apiKey,
    startPlaywright: true,
    localProxy: true,
    ...(connectionId != null ? { connectionId } : {}),
  });

  const connection = await client.start();

  // Write early lock so parent knows daemon is alive
  writeLock({ pid: process.pid, url });

  logger.info('Browser initialized');
  logger.info(`  Proxy:         ${connection.url}`);
  if (connection.cdpUrl) logger.info(`  CDP URL:       ${connection.cdpUrl}`);
  if (connectionId) logger.info(`  Connection ID: ${connectionId}`);
  logger.info(`Opening ${url} ...`);

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

  logger.info('Browser session is running.');
  if (pageTitle) logger.info(`  Page title:    ${pageTitle}`);
  if (connId) logger.info(`  Connection ID: ${connId}`);
  if (cdpUrl) logger.info(`  CDP URL:       ${cdpUrl}`);

  // Graceful shutdown handler
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    logger.info('Shutting down...');
    try {
      await connection.close();
    } catch {
      // ignore
    }
    removeLock();
    logger.info('Stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Detect when the browser is closed by the user
  if (connection.browser) {
    connection.browser.on('disconnected', () => {
      if (!stopping) {
        logger.info('Browser closed by user.');
        removeLock();
        client
          .stop()
          .catch(() => {})
          .finally(() => process.exit(0));
      }
    });
  }
}
