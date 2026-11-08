import { isRecord } from './payload.js';
import { normalizePath, type PathContext } from './project.js';

/** What an upsert did to a project list. */
export type ProjectChange = 'added' | 'updated' | 'unchanged';

/** The fields `hivefloor add-project` sets on a `publicProjects` entry. */
export interface PublicEntry {
  readonly name: string;
  readonly color?: string;
}

/** The machine config's `projects` after an upsert. */
export interface MachineUpsert {
  readonly projects: readonly unknown[];
  readonly change: ProjectChange;
  /** The public name this folder had before, when the upsert renamed it. */
  readonly previousName?: string;
}

/** The office config's `publicProjects` after an upsert, or why it can't be done. */
export type OfficeUpsert =
  | {
      readonly kind: 'ok';
      readonly projects: readonly unknown[];
      readonly change: ProjectChange;
    }
  | { readonly kind: 'conflict'; readonly existing: string };

function nameOf(project: unknown): string | undefined {
  return isRecord(project) && typeof project['name'] === 'string' ? project['name'] : undefined;
}

function replaceAt(
  projects: readonly unknown[],
  index: number,
  project: unknown,
): readonly unknown[] {
  return projects.map((current, at) => (at === index ? project : current));
}

/**
 * Makes a folder public in the machine config's `projects`. The folder is matched
 * the way the hook matches it, so a hand-written `~/code/app` is updated in place
 * and keeps its spelling, its position and any other field.
 *
 * @param projects - The `projects` list as it is in the file.
 * @param path - The project's folder.
 * @param name - The project's public name.
 * @param context - Home folder and platform.
 * @returns The new list and what changed; the same list when nothing did.
 *
 * @example
 * ```ts
 * upsertMachineProject([], '/code/app', 'App', { home: '/home/ada', windows: false });
 * // { projects: [{ path: '/code/app', public: true, name: 'App' }], change: 'added' }
 * ```
 */
export function upsertMachineProject(
  projects: readonly unknown[],
  path: string,
  name: string,
  context: PathContext,
): MachineUpsert {
  const target = normalizePath(path, context);
  const index = projects.findIndex(
    (project) =>
      isRecord(project) &&
      typeof project['path'] === 'string' &&
      normalizePath(project['path'], context) === target,
  );
  const existing = projects[index];
  if (!isRecord(existing)) {
    return { projects: [...projects, { path, public: true, name }], change: 'added' };
  }
  if (existing['public'] === true && existing['name'] === name) {
    return { projects, change: 'unchanged' };
  }
  const previousName = existing['public'] === true ? nameOf(existing) : undefined;
  return {
    projects: replaceAt(projects, index, { ...existing, public: true, name }),
    change: 'updated',
    ...(previousName === undefined ? {} : { previousName }),
  };
}

/**
 * Adds a project to the office config's `publicProjects`. An existing entry keeps
 * its other fields, and its colour unless a new one is given.
 *
 * Names are unique ignoring case (H15) but the relay compares them exactly (H4),
 * so a name that differs only by case is reported instead of being added.
 *
 * @param projects - The `publicProjects` list as it is in the file.
 * @param entry - The project's name, already trimmed, and optional colour.
 * @returns The new list and what changed, or the spelling already in the file.
 */
export function upsertOfficeProject(
  projects: readonly unknown[],
  entry: PublicEntry,
): OfficeUpsert {
  const wanted = entry.name.toLowerCase();
  const index = projects.findIndex((project) => nameOf(project)?.trim().toLowerCase() === wanted);
  const existing = projects[index];
  const existingName = nameOf(existing);
  if (!isRecord(existing) || existingName === undefined) {
    return { kind: 'ok', projects: [...projects, entry], change: 'added' };
  }
  if (existingName !== entry.name) return { kind: 'conflict', existing: existingName };
  if (entry.color === undefined || existing['color'] === entry.color) {
    return { kind: 'ok', projects, change: 'unchanged' };
  }
  return {
    kind: 'ok',
    projects: replaceAt(projects, index, { ...existing, color: entry.color }),
    change: 'updated',
  };
}
