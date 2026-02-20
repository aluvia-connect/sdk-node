import { readLock, listSessions, isProcessAlive, removeLock } from './session/lock.js';
import { ConnectError } from './errors.js';

export type ConnectResult = {
  browser: any;
  context: any;
  page: any;
  sessionName: string;
  cdpUrl: string;
  connectionId: number | undefined;
  disconnect: () => Promise<void>;
};

/**
 * Connect to a running Aluvia browser session via CDP.
 *
 * - No args: auto-discovers a single running session.
 * - With session name: connects to that specific session.
 *
 * Requires `playwright` as a peer dependency.
 */
export async function connect(sessionName?: string): Promise<ConnectResult> {
  // 1. Import Playwright
  let pw: any;
  try {
    pw = await import('playwright');
  } catch {
    throw new ConnectError('Playwright is required for connect(). Install it: npm install playwright');
  }

  // 2. Resolve session
  let resolvedName: string;

  if (sessionName) {
    resolvedName = sessionName;
  } else {
    const sessions = listSessions();
    if (sessions.length === 0) {
      throw new ConnectError('No running Aluvia sessions found. Start one with: npx aluvia-sdk session start <url>');
    }
    if (sessions.length > 1) {
      const names = sessions.map((s) => s.session).join(', ');
      throw new ConnectError(`Multiple Aluvia sessions running (${names}). Specify which one: connect('${sessions[0].session}')`);
    }
    resolvedName = sessions[0].session;
  }

  // 3. Validate session state
  const lock = readLock(resolvedName);
  if (!lock) {
    throw new ConnectError(`No Aluvia session found named '${resolvedName}'. Run 'npx aluvia-sdk session list' to list sessions.`);
  }

  if (!isProcessAlive(lock.pid)) {
    removeLock(resolvedName);
    throw new ConnectError(`Session '${resolvedName}' is no longer running. Stale lock file removed.`);
  }

  if (!lock.ready) {
    throw new ConnectError(`Session '${resolvedName}' is still starting up. Try again shortly.`);
  }

  if (!lock.cdpUrl) {
    throw new ConnectError(`Session '${resolvedName}' has no CDP URL.`);
  }

  // 4. Connect over CDP
  let browser: any;
  try {
    browser = await pw.chromium.connectOverCDP(lock.cdpUrl);
  } catch (err: any) {
    throw new ConnectError(`Failed to connect to session '${resolvedName}' at ${lock.cdpUrl}: ${err.message}`);
  }

  // 5. Get context and page
  let context: any;
  let page: any;
  try {
    context = browser.contexts()[0] ?? await browser.newContext();
    page = context.pages()[0] ?? await context.newPage();
  } catch (err: any) {
    await browser.close().catch(() => {});
    throw new ConnectError(`Connected but failed to get page: ${err.message}`);
  }

  return {
    browser,
    context,
    page,
    sessionName: resolvedName,
    cdpUrl: lock.cdpUrl,
    connectionId: lock.connectionId,
    disconnect: async () => {
      await browser.close();
    },
  };
}
