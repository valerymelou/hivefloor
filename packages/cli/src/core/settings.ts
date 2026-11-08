import { isRecord } from './payload.js';
import { trimChars } from './text.js';

/** The Claude Code hook events Hivefloor registers (docs/hooks.md). */
export const HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'Stop',
  'SubagentStart',
  'SubagentStop',
  'TaskCreated',
  'TaskCompleted',
  'SessionEnd',
] as const;

/** One of {@link HOOK_EVENTS}. */
export type HookEvent = (typeof HOOK_EVENTS)[number];

/** Claude Code settings: an object whose fields we don't own, except our hooks. */
export type Settings = Readonly<Record<string, unknown>>;

/** The outcome of changing the settings. */
export interface SettingsChange {
  readonly settings: Settings;
  /** Events whose Hivefloor hook was added, updated or removed. */
  readonly events: readonly string[];
}

function unquote(token: string): string {
  return trimChars(token, `"'`);
}

/**
 * Tells whether a hook command is one of ours: a word mentioning `hivefloor`
 * followed by `hook`, such as `hivefloor hook`, `"/opt/hivefloor/bin.mjs" hook`
 * or `npx --yes hivefloor@0.1 hook --record`.
 *
 * @param command - The `command` of a Claude Code command hook.
 * @returns `true` when Hivefloor added it.
 */
export function isHivefloorCommand(command: string): boolean {
  const tokens = command.trim().split(/\s+/).map(unquote);
  return tokens.some(
    (token, i) => token.toLowerCase().includes('hivefloor') && tokens[i + 1] === 'hook',
  );
}

function isOurHandler(handler: unknown): boolean {
  return (
    isRecord(handler) &&
    handler['type'] === 'command' &&
    typeof handler['command'] === 'string' &&
    isHivefloorCommand(handler['command'])
  );
}

function groupsOf(hooks: Settings, event: string): readonly unknown[] {
  const groups = hooks[event];
  return Array.isArray(groups) ? groups : [];
}

function handlersOf(group: unknown): readonly unknown[] {
  return isRecord(group) && Array.isArray(group['hooks']) ? group['hooks'] : [];
}

/**
 * The hook handler Hivefloor registers for every event: asynchronous, so Claude
 * Code never waits for it (H1).
 *
 * @param command - The command that runs `hivefloor hook`.
 * @returns The handler object.
 */
export function hivefloorHandler(command: string): Record<string, unknown> {
  return { type: 'command', command, async: true };
}

/**
 * Adds Hivefloor's hook to every event in {@link HOOK_EVENTS}, or updates its
 * command, without touching any other hook or setting (C1). Running it twice
 * changes nothing the second time.
 *
 * @param settings - The parsed `settings.json`.
 * @param command - The command that runs `hivefloor hook`.
 * @returns The new settings and the events that changed.
 */
export function addHooks(settings: Settings, command: string): SettingsChange {
  const hooks: Record<string, unknown> = isRecord(settings['hooks'])
    ? { ...settings['hooks'] }
    : {};
  const events: HookEvent[] = [];
  const wanted = hivefloorHandler(command);
  for (const event of HOOK_EVENTS) {
    const groups = groupsOf(hooks, event);
    const ours = groups.flatMap(handlersOf).filter(isOurHandler);
    const current = ours.length === 1 && JSON.stringify(ours[0]) === JSON.stringify(wanted);
    if (current) continue;
    const others = withoutOurHandlers(groups);
    hooks[event] = [...others, { hooks: [wanted] }];
    events.push(event);
  }
  return { settings: events.length === 0 ? settings : { ...settings, hooks }, events };
}

function withoutOurHandlers(groups: readonly unknown[]): unknown[] {
  return groups.flatMap((group) => {
    const handlers = handlersOf(group);
    if (!isRecord(group) || !handlers.some(isOurHandler)) return [group];
    const kept = handlers.filter((handler) => !isOurHandler(handler));
    return kept.length === 0 ? [] : [{ ...group, hooks: kept }];
  });
}

/**
 * Removes Hivefloor's hooks and nothing else (C13). Matcher groups and events
 * left empty by the removal are removed too; others are kept as they are.
 *
 * @param settings - The parsed `settings.json`.
 * @returns The new settings and the events that changed.
 */
export function removeHooks(settings: Settings): SettingsChange {
  const current = settings['hooks'];
  if (!isRecord(current)) return { settings, events: [] };
  const hooks: Record<string, unknown> = {};
  const events: string[] = [];
  for (const [event, value] of Object.entries(current)) {
    const groups = groupsOf(current, event);
    if (!groups.flatMap(handlersOf).some(isOurHandler)) {
      hooks[event] = value;
      continue;
    }
    const kept = withoutOurHandlers(groups);
    if (kept.length > 0) hooks[event] = kept;
    events.push(event);
  }
  if (events.length === 0) return { settings, events };
  // Rebuild in the original key order, dropping `hooks` when nothing is left.
  const keepHooks = Object.keys(hooks).length > 0;
  const next = Object.fromEntries(
    Object.entries(settings).flatMap(([key, value]): [string, unknown][] =>
      key !== 'hooks' ? [[key, value]] : keepHooks ? [[key, hooks]] : [],
    ),
  );
  return { settings: next, events };
}

/**
 * Lists the events that have a Hivefloor hook, and the commands they run.
 *
 * @param settings - The parsed `settings.json`.
 * @returns Each registered event with its command.
 */
export function registeredHooks(
  settings: Settings,
): { event: string; command: string; async: boolean }[] {
  if (!isRecord(settings['hooks'])) return [];
  const hooks = settings['hooks'];
  return Object.keys(hooks).flatMap((event) =>
    groupsOf(hooks, event)
      .flatMap(handlersOf)
      .filter(isOurHandler)
      .map((handler) => {
        const record = handler as Readonly<Record<string, unknown>>;
        return { event, command: String(record['command']), async: record['async'] === true };
      }),
  );
}
