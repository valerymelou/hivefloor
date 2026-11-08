import { join, win32, posix } from 'node:path';

/** The environment variables the CLI reads to find its folder. */
export interface HomeEnv {
  readonly HIVEFLOOR_HOME?: string | undefined;
  readonly XDG_CONFIG_HOME?: string | undefined;
  readonly APPDATA?: string | undefined;
}

/** The files the CLI keeps on the owner's machine. */
export interface HivefloorFiles {
  readonly dir: string;
  readonly config: string;
  readonly secret: string;
  readonly stateDir: string;
  readonly configCache: string;
  readonly debugLog: string;
  readonly recordings: string;
}

/**
 * Finds the CLI's folder: `$HIVEFLOOR_HOME` if set, otherwise
 * `$XDG_CONFIG_HOME/hivefloor` or `~/.config/hivefloor`, and
 * `%APPDATA%\hivefloor` on Windows.
 *
 * @param env - Environment variables.
 * @param home - The owner's home folder.
 * @param windows - `true` on Windows.
 * @returns The folder and the files in it.
 */
export function hivefloorFiles(env: HomeEnv, home: string, windows: boolean): HivefloorFiles {
  const path = windows ? win32 : posix;
  const dir =
    env.HIVEFLOOR_HOME ??
    (windows
      ? path.join(env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'hivefloor')
      : path.join(env.XDG_CONFIG_HOME ?? path.join(home, '.config'), 'hivefloor'));
  const stateDir = path.join(dir, 'state');
  return {
    dir,
    config: path.join(dir, 'config.json'),
    secret: path.join(dir, 'secret'),
    stateDir,
    configCache: path.join(stateDir, 'config.cache.json'),
    debugLog: path.join(dir, 'debug.log'),
    recordings: path.join(dir, 'recordings'),
  };
}

/**
 * The state file of a session, or of one of its subagents.
 *
 * @param stateDir - The state folder.
 * @param sessionKey - `fileKey(session_id)`.
 * @param agentKey - `fileKey(agent_id)` for a subagent.
 * @returns The file path.
 */
export function stateFile(stateDir: string, sessionKey: string, agentKey?: string): string {
  return join(
    stateDir,
    agentKey === undefined ? `${sessionKey}.json` : `${sessionKey}.${agentKey}.json`,
  );
}
