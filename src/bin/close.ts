// CLI close command — stop a running browser instance

import { Logger } from '../client/logger.js';
import { readLock, removeLock, isProcessAlive } from './lock.js';

export async function handleClose(logger: Logger): Promise<void> {
  const lock = readLock();
  if (lock === null) {
    logger.info('No running browser session found.');
    return;
  }

  if (!isProcessAlive(lock.pid)) {
    logger.info('Browser process is no longer running. Cleaning up lock file.');
    removeLock();
    return;
  }

  logger.info(`Stopping browser session (PID ${lock.pid})...`);

  try {
    process.kill(lock.pid, 'SIGTERM');
  } catch (err: any) {
    logger.error(`Failed to stop process: ${err.message}`);
    process.exit(1);
  }

  // Wait for the process to exit (up to 10 seconds)
  const maxWait = 40;
  for (let i = 0; i < maxWait; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (!isProcessAlive(lock.pid)) {
      removeLock();
      logger.info('Browser session closed successfully.');
      return;
    }
  }

  // Force kill if still alive
  logger.warn('Process did not exit gracefully. Force killing...');
  try {
    process.kill(lock.pid, 'SIGKILL');
  } catch {
    // ignore
  }
  removeLock();
  logger.info('Browser session closed.');
}
