import { readLock, listSessions } from './lock.js';
import { output } from './cli.js';

export function handleStatus(sessionName?: string): void {
  if (sessionName) {
    const lock = readLock(sessionName);
    if (!lock) {
      return output({ 'browser-session': sessionName, message: 'No session found.' });
    }
    return output({
      'browser-session': sessionName,
      pid: lock.pid,
      startUrl: lock.url ?? null,
      cdpUrl: lock.cdpUrl ?? null,
      connectionId: lock.connectionId ?? null,
      blockDetection: lock.blockDetection ?? false,
      autoUnblock: lock.autoUnblock ?? false,
      lastDetection: lock.lastDetection ?? null,
    });
  }

  const sessions = listSessions();
  return output({
    'browser-sessions': sessions.map((s) => ({
      'browser-session': s.session,
      pid: s.pid,
      startUrl: s.url ?? null,
      cdpUrl: s.cdpUrl ?? null,
      connectionId: s.connectionId ?? null,
      blockDetection: s.blockDetection ?? false,
      autoUnblock: s.autoUnblock ?? false,
      lastDetection: s.lastDetection ?? null,
    })),
    count: sessions.length,
  });
}
