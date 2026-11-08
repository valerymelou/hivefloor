import { appendFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { decide, type Decision } from '../core/decide.js';
import { fileKey } from '../core/identity.js';
import { parsePayload, readString } from '../core/payload.js';
import type { PathContext } from '../core/project.js';
import { scrubPayload } from '../core/scrub.js';
import { parseAgentState, parseSessionState } from '../core/state.js';
import { loadConfig, loadSecret } from './config.js';
import { readJson, removeWithPrefix, writeAtomic } from './files.js';
import { stateFile, type HivefloorFiles } from './home.js';

/** What the hook needs from the outside world. */
export interface HookDeps {
  readonly files: HivefloorFiles;
  readonly paths: PathContext;
  /** Unix milliseconds. */
  readonly now: () => number;
  /** Starts the detached sender for one event body. */
  readonly launchSender: (body: string) => void;
  /** Save a scrubbed copy of the payload (`--record`). */
  readonly record: boolean;
  /** Append a line per call to the debug log (`HIVEFLOOR_DEBUG=1`). */
  readonly debug: boolean;
}

async function debugLog(
  deps: HookDeps,
  hook: string | undefined,
  decision: Decision,
): Promise<void> {
  if (!deps.debug) return;
  // Only the hook name and the already-sanitized event: never the payload.
  const line = JSON.stringify({
    at: new Date(deps.now()).toISOString(),
    hook,
    event: decision.event ?? null,
  });
  await appendFile(deps.files.debugLog, `${line}\n`, { mode: 0o600 });
}

async function saveRecording(
  deps: HookDeps,
  payload: Readonly<Record<string, unknown>>,
): Promise<void> {
  const hook = readString(payload, 'hook_event_name') ?? 'unknown';
  const name = `${hook.replace(/[^A-Za-z]/g, '')}-${String(deps.now())}.json`;
  await writeAtomic(
    join(deps.files.recordings, name),
    `${JSON.stringify(scrubPayload(payload), null, 2)}\n`,
  );
}

/**
 * Runs `hivefloor hook` for one payload (C2): load config and state, decide,
 * launch the sender, save state. Never writes to stdout. Callers must still
 * catch: any failure means "do nothing".
 *
 * @param stdin - The payload text Claude Code wrote to stdin.
 * @param deps - Files, clock, sender and flags.
 */
export async function runHook(stdin: string, deps: HookDeps): Promise<void> {
  const payload = parsePayload(stdin);
  if (payload === undefined) return;
  if (deps.record) await saveRecording(deps, payload);

  const config = await loadConfig(deps.files);
  if (config === undefined || config.paused) return;
  const secret = await loadSecret(deps.files);
  const sessionId = readString(payload, 'session_id');
  if (secret === undefined || sessionId === undefined) return;

  const agentId = readString(payload, 'agent_id');
  const sessionKey = fileKey(sessionId);
  const sessionPath = stateFile(deps.files.stateDir, sessionKey);
  const agentPath =
    agentId === undefined
      ? undefined
      : stateFile(deps.files.stateDir, sessionKey, fileKey(agentId));
  const session = parseSessionState(await readJson(sessionPath));
  const agent = agentPath === undefined ? undefined : parseAgentState(await readJson(agentPath));

  const decision = decide({
    payload,
    config,
    secret,
    now: Math.floor(deps.now() / 1000),
    paths: deps.paths,
    ...(session === undefined ? {} : { session }),
    ...(agent === undefined ? {} : { agent }),
  });
  if (decision.event !== undefined) deps.launchSender(JSON.stringify(decision.event));

  if (decision.remove === 'session') {
    await removeWithPrefix(deps.files.stateDir, `${sessionKey}.`);
  } else {
    if (decision.session !== undefined)
      await writeAtomic(sessionPath, JSON.stringify(decision.session));
    if (agentPath !== undefined && decision.remove === 'agent')
      await rm(agentPath, { force: true });
    else if (agentPath !== undefined && decision.agent !== undefined)
      await writeAtomic(agentPath, JSON.stringify(decision.agent));
  }
  await debugLog(deps, readString(payload, 'hook_event_name'), decision);
}
