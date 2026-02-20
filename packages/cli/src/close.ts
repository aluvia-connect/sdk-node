import { removeLock, isProcessAlive, listSessions, toLockData } from '@aluvia/sdk';
import type { LockData } from '@aluvia/sdk';
import { output } from './cli.js';

export async function handleClose(sessionName?: string, closeAll?: boolean): Promise<void> {
  if (closeAll) {
    const sessions = listSessions();
    if (sessions.length === 0) {
      return output({ error: 'No running browser sessions found.', closed: [], count: 0 }, 1);
    }

    // Send SIGTERM to all sessions
    for (const s of sessions) {
      try {
        process.kill(s.pid, 'SIGTERM');
      } catch {
        // ignore
      }
    }

    // Wait up to 10 seconds for all processes to exit
    const maxWait = 40;
    const alive = new Set(sessions.map((s) => s.pid));
    for (let i = 0; i < maxWait && alive.size > 0; i++) {
      await new Promise((r) => setTimeout(r, 250));
      for (const pid of alive) {
        if (!isProcessAlive(pid)) {
          alive.delete(pid);
        }
      }
    }

    // Force-kill any survivors
    for (const pid of alive) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }

    // Now remove all locks
    const closed: string[] = [];
    for (const s of sessions) {
      removeLock(s.session);
      closed.push(s.session);
    }

    return output({ message: 'All browser sessions closed.', closed, count: closed.length });
  }

  // If no session name specified, figure out what to close
  if (!sessionName) {
    const sessions = listSessions();
    if (sessions.length === 0) {
      return output({ error: 'No running browser sessions found.' }, 1);
    }
    if (sessions.length > 1) {
      return output(
        {
          error: 'Multiple sessions running. Specify --browser-session <name> or --all.',
          browserSessions: sessions.map((s) => s.session),
        },
        1,
      );
    }
    // Single session — use its data directly instead of re-reading the lock file
    const session = sessions[0];
    sessionName = session.session;
    return closeSession(sessionName, toLockData(session));
  }

  // Session name provided — need to verify it's alive
  const sessions = listSessions();
  const match = sessions.find((s) => s.session === sessionName);

  if (!match) {
    return output({ browserSession: sessionName, error: 'No running browser session found.' }, 1);
  }

  return closeSession(sessionName, toLockData(match));
}

async function closeSession(sessionName: string, lock: LockData): Promise<void> {
  if (!isProcessAlive(lock.pid)) {
    removeLock(sessionName);
    return output({
      browserSession: sessionName,
      message: 'Browser process was not running. Lock file cleaned up.',
    });
  }

  try {
    process.kill(lock.pid, 'SIGTERM');
  } catch (err: any) {
    return output({ browserSession: sessionName, error: `Failed to stop process: ${err.message}` }, 1);
  }

  // Wait for the process to exit (up to 10 seconds)
  const maxWait = 40;
  for (let i = 0; i < maxWait; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (!isProcessAlive(lock.pid)) {
      removeLock(sessionName);
      return output({
        browserSession: sessionName,
        pid: lock.pid,
        message: 'Browser session closed.',
        startUrl: lock.url ?? null,
        cdpUrl: lock.cdpUrl ?? null,
        connectionId: lock.connectionId ?? null,
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
    browserSession: sessionName,
    pid: lock.pid,
    message: 'Browser session force-killed.',
    startUrl: lock.url ?? null,
    cdpUrl: lock.cdpUrl ?? null,
    connectionId: lock.connectionId ?? null,
  });
}
