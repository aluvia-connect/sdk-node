import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const LOCK_DIR = path.join(os.tmpdir(), 'aluvia-sdk');

const ADJECTIVES = [
  'swift', 'bold', 'calm', 'keen', 'warm', 'bright', 'silent', 'rapid', 'steady', 'clever',
  'vivid', 'agile', 'noble', 'lucid', 'crisp', 'gentle', 'fierce', 'nimble', 'sturdy', 'witty',
];

const NOUNS = [
  'falcon', 'tiger', 'river', 'maple', 'coral', 'cedar', 'orbit', 'prism', 'flint', 'spark',
  'ridge', 'ember', 'crane', 'grove', 'stone', 'brook', 'drift', 'crest', 'sage', 'lynx',
];

function lockFileName(sessionName?: string): string {
  return `cli-${sessionName ?? 'default'}.lock`;
}

function logFileName(sessionName?: string): string {
  return `cli-${sessionName ?? 'default'}.log`;
}

export type LockDetection = {
  hostname: string;
  lastUrl: string;
  blockStatus: string;
  score: number;
  signals: string[];
  timestamp: number;
};

export type LockData = {
  pid: number;
  session?: string;
  connectionId?: number;
  cdpUrl?: string;
  proxyUrl?: string;
  url?: string;
  ready?: boolean;
  blockDetection?: boolean;
  autoUnblock?: boolean;
  lastDetection?: LockDetection;
};

export function writeLock(data: LockData, sessionName?: string): void {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const filePath = path.join(LOCK_DIR, lockFileName(sessionName));
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

export function readLock(sessionName?: string): LockData | null {
  try {
    const filePath = path.join(LOCK_DIR, lockFileName(sessionName));
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    const parsed = JSON.parse(raw);
    if (typeof parsed.pid === 'number' && Number.isFinite(parsed.pid)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function removeLock(sessionName?: string): void {
  try {
    const filePath = path.join(LOCK_DIR, lockFileName(sessionName));
    fs.unlinkSync(filePath);
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

export function getLogFilePath(sessionName?: string): string {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  return path.join(LOCK_DIR, logFileName(sessionName));
}

export function validateSessionName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

export function generateSessionName(): string {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const name = attempt === 0 ? `${adj}-${noun}` : `${adj}-${noun}-${attempt}`;
    const filePath = path.join(LOCK_DIR, lockFileName(name));
    if (!fs.existsSync(filePath)) {
      return name;
    }
    // Lock file exists — check if the process is still alive
    const lock = readLock(name);
    if (!lock || !isProcessAlive(lock.pid)) {
      // Stale lock, we can reuse this name
      removeLock(name);
      return name;
    }
  }
  // Fallback: use timestamp
  return `session-${Date.now()}`;
}

export type SessionInfo = {
  session: string;
  pid: number;
  connectionId?: number;
  cdpUrl?: string;
  proxyUrl?: string;
  url?: string;
  ready?: boolean;
  blockDetection?: boolean;
  autoUnblock?: boolean;
  lastDetection?: LockDetection;
};

export function listSessions(): SessionInfo[] {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const files = fs.readdirSync(LOCK_DIR);
  const sessions: SessionInfo[] = [];

  for (const file of files) {
    const match = file.match(/^cli-(.+)\.lock$/);
    if (!match) continue;
    const sessionName = match[1];
    const lock = readLock(sessionName);
    if (!lock) {
      // Corrupt lock file, clean up
      removeLock(sessionName);
      continue;
    }
    if (!isProcessAlive(lock.pid)) {
      // Stale lock, clean up
      removeLock(sessionName);
      continue;
    }
    sessions.push({
      session: sessionName,
      pid: lock.pid,
      connectionId: lock.connectionId,
      cdpUrl: lock.cdpUrl,
      proxyUrl: lock.proxyUrl,
      url: lock.url,
      ready: lock.ready,
      blockDetection: lock.blockDetection,
      autoUnblock: lock.autoUnblock,
      lastDetection: lock.lastDetection,
    });
  }

  return sessions;
}
