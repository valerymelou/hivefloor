import type { MachineConfig } from '@hivefloor/schema';
import { isRecord, readArray, readString } from './payload.js';
import { HOOK_EVENTS } from './settings.js';

/** The outcome of one doctor check. */
export type CheckStatus = 'ok' | 'warn' | 'fail';

/** One line of the doctor report. */
export interface Check {
  readonly status: CheckStatus;
  readonly title: string;
  readonly detail?: string;
}

/** Clock difference above which doctor warns (H8): the relay rejects beyond 60 s. */
export const CLOCK_WARN_SEC = 30;

const check = (status: CheckStatus, title: string, detail?: string): Check =>
  detail === undefined ? { status, title } : { status, title, detail };

/**
 * Compares the local clock with the relay's `Date` header (H8).
 *
 * @param localMs - Local time in milliseconds when the response arrived.
 * @param dateHeader - The response's `Date` header.
 * @returns The check.
 */
export function clockCheck(localMs: number, dateHeader: string | null): Check {
  const remote = dateHeader === null ? Number.NaN : Date.parse(dateHeader);
  if (Number.isNaN(remote)) return check('warn', 'Clock', 'The relay sent no usable Date header.');
  const skew = Math.round((localMs - remote) / 1000);
  if (Math.abs(skew) > CLOCK_WARN_SEC) {
    return check(
      'warn',
      'Clock',
      `Your clock is ${String(Math.abs(skew))} s ${skew > 0 ? 'ahead of' : 'behind'} the relay. Beyond 60 s every event is rejected; sync your clock.`,
    );
  }
  return check('ok', 'Clock', `Within ${String(Math.abs(skew))} s of the relay.`);
}

function namesOf(office: unknown, key: string, field?: string): string[] {
  const list = isRecord(office) ? readArray(office, key) : [];
  return list.flatMap((item) => {
    if (field === undefined) return typeof item === 'string' ? [item] : [];
    const name = isRecord(item) ? readString(item, field) : undefined;
    return name === undefined ? [] : [name];
  });
}

/**
 * Checks that every public project and public agent type on this machine is
 * known to the relay (H4). Unknown names are rejected by the relay, so the robot
 * would never appear.
 *
 * @param machine - The machine config.
 * @param office - The JSON from the relay's `/api/config`.
 * @returns One check for projects and one for agent types.
 */
export function namesChecks(machine: MachineConfig, office: unknown): Check[] {
  const officeProjects = new Set(namesOf(office, 'publicProjects', 'name'));
  const officeAgents = new Set(namesOf(office, 'agentTypes'));
  const missingProjects = machine.projects.flatMap((p) =>
    p.public && p.name !== undefined && !officeProjects.has(p.name) ? [p.name] : [],
  );
  const missingAgents = machine.publicAgentTypes.filter((type) => !officeAgents.has(type));
  return [
    missingProjects.length === 0
      ? check('ok', 'Public projects', 'Every public project is known to the relay.')
      : check(
          'fail',
          'Public projects',
          `Not in the relay's office.config.json: ${missingProjects.join(', ')}. Their events are rejected; add them there and redeploy, or fix the names here.`,
        ),
    missingAgents.length === 0
      ? check('ok', 'Agent types', 'Every public agent type is known to the relay.')
      : check(
          'warn',
          'Agent types',
          `Not in the relay's agentTypes: ${missingAgents.join(', ')}. Those subagents are rejected; add them there or remove them from publicAgentTypes.`,
        ),
  ];
}

/**
 * Explains the relay's answer to the signed test event.
 *
 * @param status - The HTTP status, or `undefined` when the request failed.
 * @returns The check.
 */
export function ingestCheck(status: number | undefined): Check {
  switch (status) {
    case 204:
    case 200:
      return check(
        'ok',
        'Signed test event',
        'The relay accepted it (dry run: the office did not change).',
      );
    case 401:
    case 403:
      return check(
        'fail',
        'Signed test event',
        'The relay rejected the signature. The secret here and the relay secret differ: run init --rotate and update the relay secret.',
      );
    case 400:
    case 422:
      return check(
        'fail',
        'Signed test event',
        'The relay rejected the event. A project or agent name is probably missing from the relay config.',
      );
    case 404:
      return check(
        'fail',
        'Signed test event',
        'No relay at this address. Check the office URL, or deploy the relay.',
      );
    case 413:
      return check(
        'fail',
        'Signed test event',
        'The relay said the event is too large; this is a bug, please report it.',
      );
    case 429:
      return check(
        'warn',
        'Signed test event',
        "The relay is over Cloudflare's daily limit and pauses until the reset.",
      );
    case undefined:
      return check(
        'fail',
        'Signed test event',
        'Could not reach the relay (network error or 1.5 s timeout).',
      );
    default:
      return check('fail', 'Signed test event', `The relay answered ${String(status)}.`);
  }
}

/**
 * Checks that every Hivefloor hook is registered, asynchronous and running the
 * same command.
 *
 * @param registered - Hivefloor hooks found in the Claude Code settings.
 * @returns The check.
 */
export function hooksCheck(
  registered: readonly { event: string; command: string; async: boolean }[],
): Check {
  const events = new Set(registered.map((hook) => hook.event));
  const missing = HOOK_EVENTS.filter((event) => !events.has(event));
  if (registered.length === 0)
    return check('fail', 'Claude Code hooks', 'Not registered. Run hivefloor init.');
  if (missing.length > 0)
    return check(
      'fail',
      'Claude Code hooks',
      `Missing for ${missing.join(', ')}. Run hivefloor init.`,
    );
  if (registered.some((hook) => !hook.async))
    return check(
      'warn',
      'Claude Code hooks',
      'Some hooks are not async, so Claude Code waits for them. Run hivefloor init.',
    );
  if (new Set(registered.map((hook) => hook.command)).size > 1)
    return check('warn', 'Claude Code hooks', 'Hooks run different commands. Run hivefloor init.');
  return check(
    'ok',
    'Claude Code hooks',
    `Registered for ${String(HOOK_EVENTS.length)} events: ${registered[0]?.command ?? ''}`,
  );
}

/**
 * Formats the report, one check per line.
 *
 * @param checks - The checks in order.
 * @returns The text to print.
 */
export function formatChecks(checks: readonly Check[]): string {
  const mark: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✗' };
  return checks
    .map((c) => `${mark[c.status]} ${c.title}${c.detail === undefined ? '' : `: ${c.detail}`}`)
    .join('\n');
}
