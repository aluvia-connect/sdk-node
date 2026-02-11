import { readLock, isProcessAlive, listSessions } from './lock.js';
import { output } from './cli.js';

export function handleStatus(sessionName?: string): void {
  if (sessionName) {
    const lock = readLock(sessionName);
    if (!lock) {
      return output({ status: 'ok', session: sessionName, active: false, message: 'No session found.' });
    }
    const active = isProcessAlive(lock.pid);
    return output({
      status: 'ok',
      session: sessionName,
      active,
      pid: lock.pid,
      url: lock.url ?? null,
      cdpUrl: lock.cdpUrl ?? null,
      connectionId: lock.connectionId ?? null,
      ready: lock.ready ?? false,
    });
  }

  const sessions = listSessions();
  return output({
    status: 'ok',
    sessions: sessions.map((s) => ({
      session: s.session,
      active: true,
      pid: s.pid,
      url: s.url ?? null,
      cdpUrl: s.cdpUrl ?? null,
      connectionId: s.connectionId ?? null,
      ready: s.ready ?? false,
    })),
    count: sessions.length,
  });
}
