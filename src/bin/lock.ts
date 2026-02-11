// Lock file helpers for single-instance enforcement

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const LOCK_DIR = path.join(os.tmpdir(), 'aluvia-sdk');
const LOCK_FILE = path.join(LOCK_DIR, 'cli.lock');
const LOG_FILE = path.join(LOCK_DIR, 'cli.log');

export type LockData = {
  pid: number;
  connectionId?: number;
  cdpUrl?: string;
  url?: string;
  ready?: boolean;
};

export function writeLock(data: LockData): void {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify(data), 'utf-8');
}

export function readLock(): LockData | null {
  try {
    const raw = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
    const parsed = JSON.parse(raw);
    if (typeof parsed.pid === 'number' && Number.isFinite(parsed.pid)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function removeLock(): void {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // ignore
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = check existence
    return true;
  } catch {
    return false;
  }
}

export function getLogFilePath(): string {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  return LOG_FILE;
}
