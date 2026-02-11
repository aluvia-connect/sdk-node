import { readLock, removeLock, isProcessAlive, listSessions } from './lock.js';
import { output } from './cli.js';

export async function handleClose(sessionName?: string, closeAll?: boolean): Promise<void> {
  if (closeAll) {
    const sessions = listSessions();
    if (sessions.length === 0) {
      return output({ message: 'No running browser sessions found.', closed: [], count: 0 });
    }
    const closed: string[] = [];
    for (const s of sessions) {
      try {
        process.kill(s.pid, 'SIGTERM');
      } catch {
        // ignore
      }
      removeLock(s.session);
      closed.push(s.session);
    }
    // Wait briefly for processes to exit
    await new Promise((r) => setTimeout(r, 500));
    return output({ message: 'All browser sessions closed.', closed, count: closed.length });
  }

  // If no session name specified, figure out what to close
  if (!sessionName) {
    const sessions = listSessions();
    if (sessions.length === 0) {
      return output({ message: 'No running browser session found.' });
    }
    if (sessions.length > 1) {
      return output(
        {
          error: 'Multiple sessions running. Specify --browser-session <name> or --all.',
          'browser-sessions': sessions.map((s) => s.session),
        },
        1,
      );
    }
    sessionName = sessions[0].session;
  }

  const lock = readLock(sessionName);
  if (lock === null) {
    return output({ 'browser-session': sessionName, message: 'No running browser session found.' });
  }

  if (!isProcessAlive(lock.pid)) {
    removeLock(sessionName);
    return output({
      'browser-session': sessionName,
      message: 'Browser process was not running. Lock file cleaned up.',
    });
  }

  try {
    process.kill(lock.pid, 'SIGTERM');
  } catch (err: any) {
    return output({ 'browser-session': sessionName, error: `Failed to stop process: ${err.message}` }, 1);
  }

  // Wait for the process to exit (up to 10 seconds)
  const maxWait = 40;
  for (let i = 0; i < maxWait; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (!isProcessAlive(lock.pid)) {
      removeLock(sessionName);
      return output({
        'browser-session': sessionName,
        message: 'Browser session closed.',
        startUrl: lock.url ?? null,
        cdpUrl: lock.cdpUrl ?? null,
        connectionId: lock.connectionId ?? null,
        pid: lock.pid,
      });
    }
  }

  // Force kill if still alive
  try {
    process.kill(lock.pid, 'SIGKILL');
  } catch {
    // ignore
  }
  removeLock(sessionName);
  return output({
    'browser-session': sessionName,
    message: 'Browser session force-killed.',
    startUrl: lock.url ?? null,
    cdpUrl: lock.cdpUrl ?? null,
    connectionId: lock.connectionId ?? null,
    pid: lock.pid,
  });
}
