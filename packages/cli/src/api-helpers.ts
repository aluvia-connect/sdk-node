import {
  AluviaApi,
  readLock,
  listSessions,
  isProcessAlive,
  removeLock,
  toLockData,
} from "@aluvia/sdk";
import type { LockData } from "@aluvia/sdk";
import { output } from "./cli.js";

/**
 * Create an AluviaApi instance from ALUVIA_API_KEY env var.
 * Calls output() and exits if the key is missing.
 */
export function requireApi(): AluviaApi {
  const apiKey = (process.env.ALUVIA_API_KEY ?? "").trim();
  if (!apiKey) {
    return output(
      { error: "ALUVIA_API_KEY environment variable is required." },
      1,
    );
  }
  return new AluviaApi({ apiKey });
}

/**
 * Resolve a session by name or auto-select when only one is running.
 * Calls output() and exits on error (no sessions, ambiguous sessions, stale lock).
 */
export function resolveSession(sessionName?: string): {
  session: string;
  lock: LockData;
} {
  if (sessionName) {
    const lock = readLock(sessionName);
    if (!lock) {
      return output(
        { error: `No session found with name '${sessionName}'.` },
        1,
      );
    }
    if (!isProcessAlive(lock.pid)) {
      removeLock(sessionName);
      return output(
        {
          error: `Session '${sessionName}' is no longer running (stale lock cleaned up).`,
        },
        1,
      );
    }
    return { session: sessionName, lock };
  }

  const sessions = listSessions();
  if (sessions.length === 0) {
    return output({ error: "No running browser sessions found." }, 1);
  }
  if (sessions.length > 1) {
    return output(
      {
        error: "Multiple sessions running. Specify --browser-session <name>.",
        browserSessions: sessions.map((s) => s.session),
      },
      1,
    );
  }

  const s = sessions[0];
  return { session: s.session, lock: toLockData(s) };
}

/**
 * Require a connection ID from lock data.
 * Calls output() and exits if connectionId is missing.
 */
export function requireConnectionId(lock: LockData, session: string): number {
  if (lock.connectionId == null) {
    return output(
      {
        error: `Session '${session}' has no connection ID. It may have been started without API access.`,
      },
      1,
    );
  }
  return lock.connectionId;
}
