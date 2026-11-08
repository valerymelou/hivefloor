/**
 * Example data from docs/PRD.md, valid against the v1 schemas. Import it in tests
 * as `@hivefloor/schema/fixtures`; it is not part of the runtime API.
 *
 * @packageDocumentation
 */

/** The example `office.config.json` from docs/PRD.md (also office.config.example.json). */
export const exampleOfficeConfig = {
  $schema: './node_modules/@hivefloor/schema/office.schema.json',
  v: 1,
  title: 'Hivefloor',
  owner: 'Valery Melou',
  timezone: 'Africa/Douala',
  publicProjects: [
    { name: 'Builderswave', color: '#6ea8fe', group: 'web' },
    { name: 'Ledgerly', color: '#f2a65a', group: 'mobile' },
    { name: 'Ndop UI', color: '#b79cf2', group: 'open-source' },
  ],
  privateRoom: { name: 'Private projects', color: '#8d94ab', visible: true },
  agentTypes: ['Explore', 'Plan', 'Helper', 'code-reviewer'],
  presence: { idleAfterSec: 180, awayAfterSec: 900 },
  layout: {
    roomsPerFloor: 8,
    desksPerRow: 3,
    maxRowsPerRoom: 4,
    tableSeats: 6,
    roomCloseAfterSec: 1800,
    rowRemoveAfterSec: 600,
    maxRenderedRobots: 40,
    maxVisibleRooms: 12,
  },
  viewerCap: 500,
} as const;

/** The example machine config from docs/PRD.md. */
export const exampleMachineConfig = {
  $schema: 'https://unpkg.com/hivefloor/machine.schema.json',
  v: 1,
  endpoint: 'https://office.example.com/ingest',
  projects: [
    { path: '~/code/ledgerly', public: true, name: 'Ledgerly' },
    { path: '~/code/builderswave', public: true, name: 'Builderswave' },
  ],
  publicAgentTypes: ['Explore', 'Plan', 'code-reviewer'],
  goals: {
    fromTaskList: true,
    maxLength: 60,
    blockWords: [
      'security',
      'vulnerability',
      'CVE',
      'exploit',
      'token',
      'secret',
      'password',
      'credential',
    ],
    privatePrefix: '[private]',
  },
  mcpCategories: { Figma: 'designing', Sentry: 'monitoring' },
  timestampRoundingSec: 5,
  paused: false,
} as const;

/** Example ingest events: a public tool event, a private one, and a subagent's life. */
export const exampleIngestEvents = [
  {
    v: 1,
    t: 1794091200,
    seq: 12,
    sid: 'a9f3c2',
    role: 'claude',
    project: 'Ledgerly',
    goal: 'Building the paywall screen',
    kind: 'tool',
    cat: 'testing',
  },
  { v: 1, t: 1794091260, seq: 3, sid: '7d01aa', role: 'claude', kind: 'tool', cat: 'terminal' },
  {
    v: 1,
    t: 1794091205,
    seq: 0,
    sid: 'a9f3c2',
    aid: '4be1d0',
    role: 'Explore',
    project: 'Ledgerly',
    kind: 'spawn',
  },
  {
    v: 1,
    t: 1794091210,
    seq: 1,
    sid: 'a9f3c2',
    aid: '4be1d0',
    role: 'Explore',
    project: 'Ledgerly',
    kind: 'tool',
    cat: 'reading',
  },
  {
    v: 1,
    t: 1794091240,
    seq: 2,
    sid: 'a9f3c2',
    aid: '4be1d0',
    role: 'Explore',
    project: 'Ledgerly',
    kind: 'done',
  },
  { v: 1, t: 1794091300, seq: 0, sid: '7d01aa', role: 'claude', kind: 'start' },
  { v: 1, t: 1794091305, seq: 1, sid: '7d01aa', role: 'claude', kind: 'thinking' },
  { v: 1, t: 1794091400, seq: 4, sid: '7d01aa', role: 'claude', kind: 'idle' },
  { v: 1, t: 1794091500, seq: 5, sid: '7d01aa', role: 'claude', kind: 'end' },
] as const;

/** Example relay-to-viewer messages from docs/PRD.md, one of each type. */
export const exampleViewerMessages = [
  {
    type: 'snapshot',
    v: 1,
    at: 1794091200,
    rooms: [
      { id: 'ledgerly', name: 'Ledgerly', color: '#f2a65a', slot: 0, floor: 0, rows: 1, lit: true },
      {
        id: 'private',
        name: 'Private projects',
        color: '#8d94ab',
        slot: 1,
        floor: 0,
        rows: 2,
        lit: true,
      },
    ],
    robots: [
      {
        key: 'a9f3c2',
        role: 'claude',
        room: 'ledgerly',
        desk: 0,
        goal: 'Building the paywall screen',
        status: 'working',
        cat: 'testing',
        since: 1794091180,
      },
    ],
    today: [{ room: 'ledgerly', cat: 'testing', n: 42 }],
  },
  {
    type: 'room',
    v: 1,
    room: {
      id: 'ndop-ui',
      name: 'Ndop UI',
      color: '#b79cf2',
      slot: 2,
      floor: 0,
      rows: 1,
      lit: true,
    },
  },
  {
    type: 'delta',
    v: 1,
    robot: {
      key: 'a9f3c2:4be1d0',
      parent: 'a9f3c2',
      role: 'Explore',
      room: 'ledgerly',
      seat: 0,
      status: 'working',
      cat: 'reading',
      since: 1794091205,
    },
  },
  { type: 'leave', v: 1, key: 'a9f3c2:4be1d0' },
  { type: 'roomClosed', v: 1, id: 'ndop-ui' },
  { type: 'status', v: 1, state: 'limited', until: 1794096000 },
] as const;
