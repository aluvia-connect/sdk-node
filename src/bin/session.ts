import crypto from 'node:crypto';
import { handleOpen } from './open.js';
import type { OpenOptions } from './open.js';
import { handleClose } from './close.js';
import { listSessions } from './lock.js';
import { requireApi, resolveSession, requireConnectionId } from './api-helpers.js';
import { output } from './cli.js';

export async function handleSession(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand) {
    return output({ error: 'Missing session subcommand. Run "aluvia help" for usage.' }, 1);
  }

  switch (subcommand) {
    case 'start':
      return handleSessionStart(args.slice(1));
    case 'close':
      return handleSessionClose(args.slice(1));
    case 'list':
      return handleSessionList();
    case 'get':
      return handleSessionGet(args.slice(1));
    case 'rotate-ip':
      return handleSessionRotateIp(args.slice(1));
    case 'set-geo':
      return handleSessionSetGeo(args.slice(1));
    case 'set-rules':
      return handleSessionSetRules(args.slice(1));
    default:
      return output({ error: `Unknown session subcommand: '${subcommand}'. Run "aluvia help" for usage.` }, 1);
  }
}

function handleSessionStart(args: string[]): void {
  let url: string | undefined;
  let connectionId: number | undefined;
  let headless = true;
  let sessionName: string | undefined;
  let autoUnblock = false;
  let disableBlockDetection = false;
  let run: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--connection-id' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (!Number.isInteger(parsed) || parsed < 1) {
        output({ error: `Invalid --connection-id: '${args[i + 1]}' must be a positive integer.` }, 1);
      }
      connectionId = parsed;
      i++;
    } else if (args[i] === '--browser-session' && args[i + 1]) {
      sessionName = args[i + 1];
      i++;
    } else if (args[i] === '--run' && args[i + 1]) {
      run = args[i + 1];
      i++;
    } else if (args[i] === '--headful') {
      headless = false;
    } else if (args[i] === '--auto-unblock') {
      autoUnblock = true;
    } else if (args[i] === '--disable-block-detection') {
      disableBlockDetection = true;
    } else if (!url && !args[i].startsWith('--')) {
      url = args[i];
    }
  }

  if (!url) {
    return output(
      { error: 'URL is required. Usage: aluvia session start <url> [options]' },
      1,
    );
  }

  const opts: OpenOptions = {
    url,
    connectionId,
    headless,
    sessionName,
    autoUnblock,
    disableBlockDetection,
    run,
  };

  // Delegates to the existing open handler (spawns daemon, waits for ready)
  handleOpen(opts);
}

async function handleSessionClose(args: string[]): Promise<void> {
  let sessionName: string | undefined;
  let all = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--browser-session' && args[i + 1]) {
      sessionName = args[i + 1];
      i++;
    } else if (args[i] === '--all') {
      all = true;
    }
  }

  await handleClose(sessionName, all);
}

function handleSessionList(): never {
  const sessions = listSessions();
  return output({
    sessions: sessions.map((s) => ({
      'browser-session': s.session,
      pid: s.pid,
      startUrl: s.url ?? null,
      cdpUrl: s.cdpUrl ?? null,
      proxyUrl: s.proxyUrl ?? null,
      connectionId: s.connectionId ?? null,
      blockDetection: s.blockDetection ?? false,
      autoUnblock: s.autoUnblock ?? false,
      lastDetection: s.lastDetection ?? null,
    })),
    count: sessions.length,
  });
}

async function handleSessionGet(args: string[]): Promise<void> {
  let sessionName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--browser-session' && args[i + 1]) {
      sessionName = args[i + 1];
      i++;
    }
  }

  const { session, lock } = resolveSession(sessionName);
  const connId = lock.connectionId;

  const base: Record<string, unknown> = {
    'browser-session': session,
    pid: lock.pid,
    alive: true,
    startUrl: lock.url ?? null,
    cdpUrl: lock.cdpUrl ?? null,
    proxyUrl: lock.proxyUrl ?? null,
    connectionId: connId ?? null,
    blockDetection: lock.blockDetection ?? false,
    autoUnblock: lock.autoUnblock ?? false,
    lastDetection: lock.lastDetection ?? null,
  };

  // If we have a connection ID, enrich with API data
  if (connId != null) {
    try {
      const api = requireApi();
      const conn = await api.account.connections.get(connId);
      if (conn) {
        base.rules = conn.rules ?? [];
        base.sessionId = conn.session_id ?? null;
        base.targetGeo = conn.target_geo ?? null;

        // Build gateway proxy object with plaintext credentials
        if (conn.proxy_username && conn.proxy_password) {
          const host = 'gateway.aluvia.io';
          const port = 8080;
          const protocol = 'http';
          base.gatewayProxy = {
            url: `${protocol}://${conn.proxy_username}:${conn.proxy_password}@${host}:${port}`,
            host,
            port,
            protocol,
            username: conn.proxy_username,
            password: conn.proxy_password,
          };
        }
      }
    } catch {
      // API enrichment is best-effort; base lock data is still returned
    }
  }

  return output(base);
}

async function handleSessionRotateIp(args: string[]): Promise<void> {
  let sessionName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--browser-session' && args[i + 1]) {
      sessionName = args[i + 1];
      i++;
    }
  }

  const { session, lock } = resolveSession(sessionName);
  const connId = requireConnectionId(lock, session);
  const api = requireApi();

  const newSessionId = crypto.randomUUID();
  await api.account.connections.patch(connId, { session_id: newSessionId });

  return output({
    'browser-session': session,
    connectionId: connId,
    sessionId: newSessionId,
  });
}

async function handleSessionSetGeo(args: string[]): Promise<void> {
  let sessionName: string | undefined;
  let geo: string | undefined;
  let clear = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--browser-session' && args[i + 1]) {
      sessionName = args[i + 1];
      i++;
    } else if (args[i] === '--clear') {
      clear = true;
    } else if (!geo && !args[i].startsWith('--')) {
      geo = args[i];
    }
  }

  if (!geo && !clear) {
    return output({ error: 'Geo code is required. Usage: aluvia session set-geo <geo> [--browser-session <name>]' }, 1);
  }

  const { session, lock } = resolveSession(sessionName);
  const connId = requireConnectionId(lock, session);
  const api = requireApi();

  const targetGeo = clear ? null : (geo!.trim() || null);
  await api.account.connections.patch(connId, { target_geo: targetGeo });

  return output({
    'browser-session': session,
    connectionId: connId,
    targetGeo,
  });
}

async function handleSessionSetRules(args: string[]): Promise<void> {
  let sessionName: string | undefined;
  let removeRules: string | undefined;
  let appendRules: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--browser-session' && args[i + 1]) {
      sessionName = args[i + 1];
      i++;
    } else if (args[i] === '--remove' && args[i + 1]) {
      removeRules = args[i + 1];
      i++;
    } else if (!appendRules && !args[i].startsWith('--')) {
      appendRules = args[i];
    }
  }

  if (!appendRules && !removeRules) {
    return output({ error: 'Rules are required. Usage: aluvia session set-rules <rules> [--browser-session <name>]' }, 1);
  }

  const { session, lock } = resolveSession(sessionName);
  const connId = requireConnectionId(lock, session);
  const api = requireApi();

  // Fetch current rules
  const conn = await api.account.connections.get(connId);
  const currentRules: string[] = conn?.rules ?? [];

  let newRules: string[];

  if (removeRules) {
    // Remove mode: filter out specified rules
    const toRemove = new Set(removeRules.split(',').map((r) => r.trim()).filter(Boolean));
    newRules = currentRules.filter((r) => !toRemove.has(r));
  } else {
    // Append mode: add new rules to existing
    const toAdd = appendRules!.split(',').map((r) => r.trim()).filter(Boolean);
    newRules = [...currentRules, ...toAdd];
  }

  await api.account.connections.patch(connId, { rules: newRules });

  return output({
    'browser-session': session,
    connectionId: connId,
    rules: newRules,
    count: newRules.length,
  });
}
