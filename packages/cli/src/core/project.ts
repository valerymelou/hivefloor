import type { MachineConfig } from '@hivefloor/schema';

/** Where the CLI runs, for path handling. */
export interface PathContext {
  /** The owner's home folder, used to expand `~`. */
  readonly home: string;
  /** `true` on Windows: backslashes and case-insensitive paths. */
  readonly windows: boolean;
}

/** The project a working directory belongs to (C4). */
export interface ProjectMatch {
  readonly isPublic: boolean;
  /** The public project's name in `office.config.json`; only for public projects. */
  readonly name?: string;
}

/**
 * Normalises a path for prefix matching: expands a leading `~`, uses forward
 * slashes, collapses repeated slashes and drops a trailing slash. On Windows the
 * result is lowercase, because paths there are case-insensitive.
 *
 * @param path - An absolute path, or one starting with `~`.
 * @param context - Home folder and platform.
 * @returns The normalised path.
 *
 * @example
 * ```ts
 * normalizePath('~/code/ledgerly/', { home: '/home/ada', windows: false }); // "/home/ada/code/ledgerly"
 * normalizePath('C:\\Code\\App', { home: 'C:\\Users\\ada', windows: true }); // "c:/code/app"
 * ```
 */
export function normalizePath(path: string, context: PathContext): string {
  let result = path.trim();
  if (result === '~' || result.startsWith('~/') || result.startsWith('~\\')) {
    result = context.home + result.slice(1);
  }
  if (context.windows) {
    result = result.replaceAll('\\', '/').toLowerCase();
  }
  result = result.replace(/\/{2,}/g, '/');
  if (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result;
}

function isInside(path: string, folder: string): boolean {
  return folder === '/' || path === folder || path.startsWith(`${folder}/`);
}

/**
 * Finds the configured project for a working directory: the longest configured
 * path that contains it. Folders that match nothing are private.
 *
 * @param cwd - The session's working directory.
 * @param projects - The `projects` list of the machine config.
 * @param context - Home folder and platform.
 * @returns Whether the folder is public, and its public name.
 */
export function resolveProject(
  cwd: string,
  projects: MachineConfig['projects'],
  context: PathContext,
): ProjectMatch {
  const target = normalizePath(cwd, context);
  let best: { length: number; project: MachineConfig['projects'][number] } | undefined;
  for (const project of projects) {
    const folder = normalizePath(project.path, context);
    if (isInside(target, folder) && (best === undefined || folder.length > best.length)) {
      best = { length: folder.length, project };
    }
  }
  if (best?.project.public !== true || best.project.name === undefined) {
    return { isPublic: false };
  }
  return { isPublic: true, name: best.project.name };
}
