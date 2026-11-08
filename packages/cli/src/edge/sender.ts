import { realpathSync } from 'node:fs';
import { signBody } from '../core/sign.js';

/** The request timeout of the sender (C9). */
export const SEND_TIMEOUT_MS = 1500;

/** What `sendEvent` needs. */
export interface SendOptions {
  readonly endpoint: string;
  readonly secret: string;
  /** Unix milliseconds. */
  readonly now: () => number;
  readonly fetch: typeof fetch;
  /** Ask the relay to verify the event without changing the office (`hivefloor doctor`). */
  readonly dryRun?: boolean;
}

/**
 * POSTs one signed event to the relay. Errors are not thrown: the hook must
 * never fail, so a failure is reported as `undefined`.
 *
 * @param body - The event JSON, exactly as signed.
 * @param options - Endpoint, secret, clock and `fetch`.
 * @returns The HTTP status, or `undefined` when the request failed.
 */
export async function sendEvent(body: string, options: SendOptions): Promise<number | undefined> {
  const timestamp = Math.floor(options.now() / 1000);
  try {
    const response = await options.fetch(options.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-office-timestamp': String(timestamp),
        'x-office-signature': signBody(options.secret, timestamp, body),
        ...(options.dryRun === true ? { 'x-office-dry-run': '1' } : {}),
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    return response.status;
  } catch {
    return undefined;
  }
}

/**
 * The real path of the running script. A global npm install starts the CLI
 * through a symlink named `hivefloor`, which has no file extension and so would
 * look like a compiled binary. A compiled binary's virtual path can't be
 * resolved and is returned as it is.
 *
 * @param script - `process.argv[1]`.
 * @returns The path with symlinks followed, or `script` when that isn't possible.
 */
export function realScriptPath(script: string | undefined): string | undefined {
  if (script === undefined) return undefined;
  try {
    return realpathSync(script);
  } catch {
    return script;
  }
}

/**
 * The command that starts this CLI again: the executable, plus the script path
 * when running a `.js` bundle under Node or Bun (a compiled binary has none).
 *
 * @param execPath - `process.execPath`.
 * @param script - The running script, from {@link realScriptPath}.
 * @returns The executable and the arguments that come before the command.
 */
export function selfCommand(
  execPath: string,
  script: string | undefined,
): { file: string; args: string[] } {
  const isScript = script !== undefined && /\.(c|m)?js$/.test(script);
  return { file: execPath, args: isScript ? [script] : [] };
}
