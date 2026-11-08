import * as z from 'zod';
import { FALLBACK_AGENT_TYPE, RESERVED_ROOM_IDS } from './constants.js';
import { AgentTypeSchema, ColorSchema, NameSchema, VersionSchema } from './primitives.js';
import { slugify } from './text.js';

/**
 * Tells whether a string is an IANA time zone the runtime knows, such as
 * `Africa/Douala`.
 *
 * @param value - The time zone name.
 * @returns `true` when `Intl` accepts it.
 */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** A public project: its room's name, optional colour and optional group (E1). */
export const PublicProjectSchema = z.strictObject({
  name: NameSchema.describe(
    'The room name. Must match the project name in the machine config exactly.',
  ),
  color: ColorSchema.optional().describe(
    'The room colour as #rrggbb. Without one, a colour is picked from a fixed palette.',
  ),
  /** Stored and passed to the layout, but not acted on in v1. */
  group: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a lowercase slug such as "web"')
    .max(40)
    .optional()
    .describe('A lowercase slug such as "web". Stored, but not used yet.'),
});

/** A public project entry of `office.config.json`. */
export type PublicProject = z.infer<typeof PublicProjectSchema>;

/** The shared room for every private session (E1, H3). */
export const PrivateRoomSchema = z.strictObject({
  name: NameSchema.default('Private projects').describe('The room name.'),
  color: ColorSchema.default('#8d94ab').describe('The room colour as #rrggbb.'),
  /** `false` hides the private room and its robots from visitors entirely (H3). */
  visible: z
    .boolean()
    .default(true)
    .describe('Set to false to hide the private room and its robots from visitors entirely.'),
});

/** Presence timings (R5). */
export const PresenceSchema = z
  .strictObject({
    idleAfterSec: z
      .int()
      .min(30)
      .max(3600)
      .default(180)
      .describe('Seconds without an event before a robot goes for coffee.'),
    awayAfterSec: z
      .int()
      .min(60)
      .max(86_400)
      .default(900)
      .describe(
        'Seconds without an event before a robot leaves the building until its next event.',
      ),
    /** A robot with no event for this long leaves, so crashed sessions don't stay forever (H9). */
    leaveAfterSec: z
      .int()
      .min(120)
      .max(604_800)
      .default(3600)
      .describe('Seconds without an event before a robot is removed from the office.'),
  })
  .refine((p) => p.idleAfterSec < p.awayAfterSec, {
    message: 'idleAfterSec must be less than awayAfterSec',
    path: ['awayAfterSec'],
  })
  .refine((p) => p.awayAfterSec < p.leaveAfterSec, {
    message: 'awayAfterSec must be less than leaveAfterSec',
    path: ['leaveAfterSec'],
  });

/** Presence timings. */
export type Presence = z.infer<typeof PresenceSchema>;

/** Limits of the elastic office (E1–E9). */
export const LayoutLimitsSchema = z.strictObject({
  roomsPerFloor: z
    .int()
    .min(2)
    .max(16)
    .multipleOf(2)
    .default(8)
    .describe('Rooms on a floor before a new floor starts. Must be even.'),
  desksPerRow: z.int().min(1).max(6).default(3).describe('Desks in a row.'),
  maxRowsPerRoom: z.int().min(1).max(8).default(4).describe('Desk rows a room can grow to.'),
  tableSeats: z.int().min(1).max(12).default(6).describe('Seats for subagents at the team table.'),
  roomCloseAfterSec: z
    .int()
    .min(60)
    .max(86_400)
    .default(1800)
    .describe('Seconds a room stays empty before it closes and frees its place.'),
  rowRemoveAfterSec: z
    .int()
    .min(0)
    .max(86_400)
    .default(600)
    .describe('Seconds an empty desk row stays before it is removed.'),
  maxRenderedRobots: z
    .int()
    .min(1)
    .max(500)
    .default(40)
    .describe('Robots drawn at once. The rest show as a "+N" sign; the list view shows everyone.'),
  maxVisibleRooms: z
    .int()
    .min(2)
    .max(64)
    .default(12)
    .describe('Rooms drawn at once. The quietest fold into an "Other projects" room.'),
});

/** Limits of the elastic office. */
export type LayoutLimits = z.infer<typeof LayoutLimitsSchema>;

/** The default layout limits from docs/PRD.md. */
export const DEFAULT_LAYOUT_LIMITS: LayoutLimits = LayoutLimitsSchema.parse({});

/**
 * `office.config.json`: the public office config. The relay serves it at
 * `/api/config` and builds its allowlists from it.
 */
export const OfficeConfigSchema = z
  .strictObject({
    $schema: z.string().optional().describe('The JSON Schema, for editor autocomplete.'),
    v: VersionSchema.describe('The config version. Always 1.'),
    title: NameSchema.default('Hivefloor').describe('The office name, shown in the header.'),
    owner: NameSchema.describe('Your name, shown under the title.'),
    timezone: z
      .string()
      .refine(isTimeZone, 'Expected an IANA time zone such as "Africa/Douala"')
      .describe('Your IANA time zone, such as "Africa/Douala". Used for the daily reset time.'),
    publicProjects: z
      .array(PublicProjectSchema)
      .max(100)
      .default([])
      .describe('Projects shown by name. Everything else goes to the private room.'),
    privateRoom: PrivateRoomSchema.default({
      name: 'Private projects',
      color: '#8d94ab',
      visible: true,
    }).describe('The shared room for every private session.'),
    agentTypes: z
      .array(AgentTypeSchema)
      .max(50)
      .default([FALLBACK_AGENT_TYPE])
      .describe('Subagent types the relay accepts by name.'),
    presence: PresenceSchema.default({
      idleAfterSec: 180,
      awayAfterSec: 900,
      leaveAfterSec: 3600,
    }).describe('When quiet robots go for coffee, step out and leave.'),
    layout: LayoutLimitsSchema.default(DEFAULT_LAYOUT_LIMITS).describe(
      'Limits of the elastic office.',
    ),
    viewerCap: z
      .int()
      .min(1)
      .max(10_000)
      .default(500)
      .describe('Live visitors at once. Others get a view that updates every few minutes.'),
  })
  .superRefine((config, ctx) => {
    // H15: names and slugs are unique, and no project takes a reserved room id.
    const seenNames = new Map<string, number>();
    const seenSlugs = new Map<string, number>();
    config.publicProjects.forEach((project, index) => {
      const path = ['publicProjects', index, 'name'];
      const lower = project.name.trim().toLowerCase();
      const slug = slugify(project.name);
      if (seenNames.has(lower)) {
        ctx.addIssue({ code: 'custom', path, message: `Duplicate project name "${project.name}"` });
      } else if (seenSlugs.has(slug)) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: `"${project.name}" has the same room id as another project`,
        });
      }
      if (slug.length === 0) {
        ctx.addIssue({ code: 'custom', path, message: 'Name needs at least one letter or digit' });
      }
      if (RESERVED_ROOM_IDS.includes(slug)) {
        ctx.addIssue({ code: 'custom', path, message: `"${slug}" is a reserved room id` });
      }
      seenNames.set(lower, index);
      seenSlugs.set(slug, index);
    });
    if (new Set(config.agentTypes).size !== config.agentTypes.length) {
      ctx.addIssue({ code: 'custom', path: ['agentTypes'], message: 'Agent types must be unique' });
    }
  });

/** A parsed `office.config.json`, with every default applied. */
export type OfficeConfig = z.infer<typeof OfficeConfigSchema>;

/** `office.config.json` as written by hand, before defaults. */
export type OfficeConfigInput = z.input<typeof OfficeConfigSchema>;
