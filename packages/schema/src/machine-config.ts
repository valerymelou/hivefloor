import { z } from 'zod';
import { GOAL_MAX_LENGTH } from './constants.js';
import { AgentTypeSchema, CategorySchema, NameSchema, VersionSchema } from './primitives.js';

/** The default words that keep a task title from being sent as a goal (H2). */
export const DEFAULT_BLOCK_WORDS: readonly string[] = [
  'security',
  'vulnerability',
  'CVE',
  'exploit',
  'token',
  'secret',
  'password',
  'credential',
];

/**
 * Tells whether a string is an ingest endpoint URL: `https`, or `http` on a local
 * development host.
 *
 * @param value - The URL to check.
 * @returns `true` for `https://…` URLs and `http://localhost…` style URLs.
 */
export function isEndpointUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') {
    return true;
  }
  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  return url.protocol === 'http:' && localHosts.includes(url.hostname);
}

/** A local folder and whether its sessions are public (C4). */
export const MachineProjectSchema = z
  .strictObject({
    /** Absolute path, or one starting with `~`. Matched by longest prefix. */
    path: z.string().min(1).max(1024),
    public: z.boolean(),
    /** The project's name in `office.config.json`. Required when `public` is true. */
    name: NameSchema.optional(),
  })
  .refine((project) => !project.public || project.name !== undefined, {
    message: 'A public project needs the name it has in office.config.json',
    path: ['name'],
  });

/** A project entry of the machine config. */
export type MachineProject = z.infer<typeof MachineProjectSchema>;

/** Goal extraction settings (C7, H2). */
export const GoalSettingsSchema = z.strictObject({
  fromTaskList: z.boolean().default(true),
  maxLength: z.int().min(10).max(GOAL_MAX_LENGTH).default(GOAL_MAX_LENGTH),
  blockWords: z
    .array(z.string().min(1).max(40))
    .max(200)
    .default([...DEFAULT_BLOCK_WORDS]),
  privatePrefix: z.string().min(1).max(20).default('[private]'),
});

/**
 * `~/.config/hivefloor/config.json`: the private machine config. It never leaves
 * the owner's machine. The shared secret is stored in a separate `secret` file.
 */
export const MachineConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  v: VersionSchema,
  endpoint: z.string().refine(isEndpointUrl, 'Expected an https URL (http only for localhost)'),
  projects: z.array(MachineProjectSchema).max(500).default([]),
  publicAgentTypes: z.array(AgentTypeSchema).max(50).default([]),
  goals: GoalSettingsSchema.default({
    fromTaskList: true,
    maxLength: GOAL_MAX_LENGTH,
    blockWords: [...DEFAULT_BLOCK_WORDS],
    privatePrefix: '[private]',
  }),
  /** Local MCP server name to category. Server names are only read locally (C5). */
  mcpCategories: z.record(z.string().min(1).max(100), CategorySchema).default({}),
  timestampRoundingSec: z.int().min(1).max(60).default(5),
  paused: z.boolean().default(false),
});

/** A parsed machine config, with every default applied. */
export type MachineConfig = z.infer<typeof MachineConfigSchema>;

/** The machine config as written by hand, before defaults. */
export type MachineConfigInput = z.input<typeof MachineConfigSchema>;
