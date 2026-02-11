import { readLock, removeLock, isProcessAlive } from './lock.js';
import { output } from './cli.js';

export async function handleClose(): Promise<void> {
  const lock = readLock();
  if (lock === null) {
    output({ status: 'ok', message: 'No running browser session found.' });
  }

  if (!isProcessAlive(lock!.pid)) {
    removeLock();
    output({ status: 'ok', message: 'Browser process was not running. Lock file cleaned up.' });
  }

  try {
    process.kill(lock!.pid, 'SIGTERM');
  } catch (err: any) {
    output({ status: 'error', error: `Failed to stop process: ${err.message}` }, 1);
  }

  // Wait for the process to exit (up to 10 seconds)
  const maxWait = 40;
  for (let i = 0; i < maxWait; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (!isProcessAlive(lock!.pid)) {
      removeLock();
      output({
        status: 'ok',
        message: 'Browser session closed.',
        url: lock!.url ?? null,
        cdpUrl: lock!.cdpUrl ?? null,
        connectionId: lock!.connectionId ?? null,
        pid: lock!.pid,
      });
    }
  }

  // Force kill if still alive
  try {
    process.kill(lock!.pid, 'SIGKILL');
  } catch {
    // ignore
  }
  removeLock();
  output({
    status: 'ok',
    message: 'Browser session force-killed.',
    url: lock!.url ?? null,
    cdpUrl: lock!.cdpUrl ?? null,
    connectionId: lock!.connectionId ?? null,
    pid: lock!.pid,
  });
}
