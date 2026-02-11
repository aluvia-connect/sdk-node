import { AluviaClient } from '../client/AluviaClient.js';
import { writeLock, readLock, removeLock, isProcessAlive, getLogFilePath, generateSessionName } from './lock.js';
import type { LockDetection } from './lock.js';
import type { BlockDetectionResult } from '../client/BlockDetection.js';
import { output } from './cli.js';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

export type OpenOptions = {
  url: string;
  connectionId?: number;
  headless?: boolean;
  sessionName?: string;
  autoUnblock?: boolean;
  disableBlockDetection?: boolean;
};

/**
 * Called from cli.ts when running `open <url>`.
 * Spawns the actual browser in a detached child and returns immediately.
 */
export function handleOpen({ url, connectionId, headless, sessionName, autoUnblock, disableBlockDetection }: OpenOptions): void {
  // Generate session name if not provided
  const session = sessionName ?? generateSessionName();

  // Check for existing instance with this session name
  const existing = readLock(session);
  if (existing !== null && isProcessAlive(existing.pid)) {
    return output(
      {
        error: `A browser session named '${session}' is already running.`,
        'browser-session': session,
        startUrl: existing.url ?? null,
        cdpUrl: existing.cdpUrl ?? null,
        connectionId: existing.connectionId ?? null,
        pid: existing.pid,
      },
      1,
    );
  }

  // Clean up stale lock if process is dead
  if (existing !== null) {
    removeLock(session);
  }

  // Require API key
  const apiKey = process.env.ALUVIA_API_KEY;
  if (!apiKey) {
    return output({ error: 'ALUVIA_API_KEY environment variable is required.' }, 1);
  }

  // Spawn a detached child process that runs the daemon
  const logFile = getLogFilePath(session);
  const out = fs.openSync(logFile, 'a');

  const args = ['--daemon', url, '--browser-session', session];
  if (connectionId != null) {
    args.push('--connection-id', String(connectionId));
  }
  if (!headless) {
    args.push('--headful');
  }
  if (autoUnblock) {
    args.push('--auto-unblock');
  }
  if (disableBlockDetection) {
    args.push('--disable-block-detection');
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
    const lock = readLock(session);
    if (lock && lock.ready) {
      clearInterval(poll);
      return output({
        'browser-session': session,
        autoUnblock: !!autoUnblock,
        startUrl: lock.url ?? null,
        cdpUrl: lock.cdpUrl ?? null,
        connectionId: lock.connectionId ?? null,
        pid: lock.pid,
      });
    }
    if (attempts >= maxAttempts) {
      clearInterval(poll);
      const alive = child.pid ? isProcessAlive(child.pid) : false;
      return output(
        {
          'browser-session': session,
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
export async function handleOpenDaemon({ url, connectionId, headless, sessionName, autoUnblock, disableBlockDetection }: OpenOptions): Promise<void> {
  const apiKey = process.env.ALUVIA_API_KEY!;

  const blockDetectionEnabled = !disableBlockDetection;

  const updateLockWithDetection = (result: BlockDetectionResult) => {
    const lock = readLock(sessionName);
    if (!lock) return;
    const lastDetection: LockDetection = {
      hostname: result.hostname,
      lastUrl: result.url,
      blockStatus: result.tier,
      score: result.score,
      signals: result.signals.map((s) => s.name),
      timestamp: Date.now(),
    };
    writeLock({ ...lock, lastDetection }, sessionName);
  };

  const client = new AluviaClient({
    apiKey,
    startPlaywright: true,
    ...(connectionId != null ? { connectionId } : {}),
    headless: headless ?? true,
    blockDetection: blockDetectionEnabled
      ? autoUnblock
        ? { enabled: true, autoUnblock: true, onDetection: updateLockWithDetection }
        : { enabled: true, onDetection: updateLockWithDetection }
      : { enabled: false },
  });

  const connection = await client.start();

  // Write early lock so parent knows daemon is alive
  writeLock({ pid: process.pid, session: sessionName, url, blockDetection: blockDetectionEnabled, autoUnblock: blockDetectionEnabled && !!autoUnblock }, sessionName);

  if (autoUnblock) console.log('[daemon] Auto-unblock enabled');
  console.log(`[daemon] Browser initialized — proxy: ${connection.url}`);
  if (connection.cdpUrl) console.log(`[daemon] CDP URL: ${connection.cdpUrl}`);
  if (connectionId != null) console.log(`[daemon] Connection ID: ${connectionId}`);
  if (sessionName) console.log(`[daemon] Session: ${sessionName}`);
  console.log(`[daemon] Opening ${url}`);

  // Navigate to URL in the browser
  const page = await connection.browserContext.newPage();
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
  writeLock(
    {
      pid: process.pid,
      session: sessionName,
      connectionId: connId,
      cdpUrl,
      url,
      ready: true,
      blockDetection: blockDetectionEnabled,
      autoUnblock: blockDetectionEnabled && !!autoUnblock,
    },
    sessionName,
  );

  console.log(
    `[daemon] Session ready — session: ${sessionName ?? 'default'}, url: ${url}, cdpUrl: ${cdpUrl}, connectionId: ${connId ?? 'unknown'}, pid: ${process.pid}`,
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
    removeLock(sessionName);
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
        removeLock(sessionName);
        client
          .stop()
          .catch(() => {})
          .finally(() => process.exit(0));
      }
    });
  }
}
