import { trimChars } from './text.js';

/** How the CLI is running, to pick the command Claude Code should call. */
export interface Runtime {
  /** `process.execPath`. */
  readonly execPath: string;
  /** `process.argv[1]`: the script, or a virtual path inside a compiled binary. */
  readonly script: string | undefined;
  readonly version: string;
  readonly windows: boolean;
}

/** The command to register and, when it is fragile, why. */
export interface HookCommand {
  readonly command: string;
  readonly warning?: string;
}

/**
 * Quotes one argument for the shell Claude Code runs hook commands in, only
 * when it needs it.
 *
 * @param arg - A path or word.
 * @param windows - `true` on Windows.
 * @returns The argument, quoted if it contains spaces or shell characters.
 */
export function quoteArg(arg: string, windows: boolean): string {
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(arg)) return arg;
  return windows ? `"${arg.replaceAll('"', '""')}"` : `'${arg.replaceAll("'", `'\\''`)}'`;
}

function isScript(path: string | undefined): path is string {
  return path !== undefined && /\.(c|m)?js$/.test(path);
}

/**
 * Picks the command `hivefloor init` registers: absolute paths, so the hook
 * works whatever `PATH` Claude Code runs it with.
 *
 * - A compiled binary registers itself.
 * - A global npm install registers Node and the script.
 * - A run through `npx` registers `npx --yes hivefloor@VERSION hook`, which works
 *   but starts slowly, so it comes with a warning.
 *
 * @param runtime - How the CLI is running now.
 * @returns The command and an optional warning.
 */
export function hookCommand(runtime: Runtime): HookCommand {
  const q = (arg: string): string => quoteArg(arg, runtime.windows);
  if (!isScript(runtime.script)) {
    return { command: `${q(runtime.execPath)} hook` };
  }
  if (/[\\/]_npx[\\/]/.test(runtime.script)) {
    return {
      command: `npx --yes hivefloor@${runtime.version} hook`,
      warning:
        'You ran init through npx, so every hook call will start npx. Install hivefloor globally (npm install -g hivefloor) or use the standalone binary, then run init again.',
    };
  }
  return { command: `${q(runtime.execPath)} ${q(runtime.script)} hook` };
}

/**
 * Turns the office URL the owner types into the ingest endpoint.
 *
 * @param url - For example `https://office.example.com` or `https://example.com/office/`.
 * @returns The `/ingest` URL, or `undefined` when the text is not an http(s) URL.
 */
export function endpointFromOfficeUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
  const path = trimChars(parsed.pathname, '/', 'end');
  const base = path.endsWith('/ingest') ? path.slice(0, -'/ingest'.length) : path;
  return `${parsed.origin}${base}/ingest`;
}

/**
 * The relay's base URL, from the ingest endpoint.
 *
 * @param endpoint - The machine config's `endpoint`.
 * @returns The URL that `/api/config` is relative to.
 */
export function relayBase(endpoint: string): string {
  return endpoint.replace(/\/ingest$/, '');
}
