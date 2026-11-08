import * as z from 'zod';
import { GOAL_MAX_LENGTH } from './constants.js';
import { AgentTypeSchema, CategorySchema, NameSchema, VersionSchema } from './primitives.js';
import { isEndpointUrl } from './urls.js';

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

/** A local folder and whether its sessions are public (C4). */
export const MachineProjectSchema = z
  .strictObject({
    /** Absolute path, or one starting with `~`. Matched by longest prefix. */
    path: z
      .string()
      .min(1)
      .max(1024)
      .describe('An absolute folder, or one starting with ~. The longest matching path wins.'),
    public: z
      .boolean()
      .describe('Whether sessions here show the project name and goals to visitors.'),
    /** The project's name in `office.config.json`. Required when `public` is true. */
    name: NameSchema.optional().describe(
      'The project name in office.config.json. Required when public is true.',
    ),
  })
  .refine((project) => !project.public || project.name !== undefined, {
    message: 'A public project needs the name it has in office.config.json',
    path: ['name'],
  });

/** A project entry of the machine config. */
export type MachineProject = z.infer<typeof MachineProjectSchema>;

/** Goal extraction settings (C7, H2). */
export const GoalSettingsSchema = z.strictObject({
  /** Use the in-progress task's subject, when Claude Code's task tools are on. */
  fromTaskList: z.boolean().default(true).describe('Use the task Claude has in progress.'),
  /** Use the session's custom title (`--name`, `/rename`) when no task is in progress. */
  fromSessionTitle: z
    .boolean()
    .default(true)
    .describe('Use the session title when no task is in progress.'),
  maxLength: z
    .int()
    .min(10)
    .max(GOAL_MAX_LENGTH)
    .default(GOAL_MAX_LENGTH)
    .describe('Longest goal sent, in characters.'),
  blockWords: z
    .array(z.string().min(1).max(40))
    .max(200)
    .default([...DEFAULT_BLOCK_WORDS])
    .describe('A goal containing any of these words is not sent.'),
  privatePrefix: z
    .string()
    .min(1)
    .max(20)
    .default('[private]')
    .describe('A task title starting with this is never sent.'),
});

/**
 * `~/.config/hivefloor/config.json`: the private machine config. It never leaves
 * the owner's machine. The shared secret is stored in a separate `secret` file.
 */
export const MachineConfigSchema = z.strictObject({
  $schema: z.string().optional().describe('The JSON Schema, for editor autocomplete.'),
  v: VersionSchema.describe('The config version. Always 1.'),
  endpoint: z
    .string()
    .refine(isEndpointUrl, 'Expected an https URL (http only for localhost)')
    .describe('The relay ingest URL: https, or http for localhost only.'),
  projects: z
    .array(MachineProjectSchema)
    .max(500)
    .default([])
    .describe('Folders and whether they are public. Any other folder is private.'),
  publicAgentTypes: z
    .array(AgentTypeSchema)
    .max(50)
    .default([])
    .describe('Subagent types sent by name. Others are sent as a generic helper.'),
  goals: GoalSettingsSchema.default({
    fromTaskList: true,
    fromSessionTitle: true,
    maxLength: GOAL_MAX_LENGTH,
    blockWords: [...DEFAULT_BLOCK_WORDS],
    privatePrefix: '[private]',
  }).describe('Which goals are sent for public projects.'),
  /** Local MCP server name to category. Server names are only read locally (C5). */
  mcpCategories: z
    .record(z.string().min(1).max(100), CategorySchema)
    .default({})
    .describe('MCP server name to work category. Server names are only read locally.'),
  timestampRoundingSec: z
    .int()
    .min(1)
    .max(60)
    .default(5)
    .describe('Timestamps are rounded to this many seconds, so timing reveals less.'),
  paused: z.boolean().default(false).describe('Send nothing. Set by hivefloor pause and resume.'),
});

/** A parsed machine config, with every default applied. */
export type MachineConfig = z.infer<typeof MachineConfigSchema>;

/** The machine config as written by hand, before defaults. */
export type MachineConfigInput = z.input<typeof MachineConfigSchema>;
