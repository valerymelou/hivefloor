import type { Category, RobotStatus } from '@hivefloor/schema';

/**
 * Every piece of overlay copy, in one place so translations can be added later
 * (docs/PRD.md, "Internationalization"). English ships in v1.
 */
export const STRINGS = {
  claude: 'Claude',
  privateProject: 'Private project',
  agentsWorking: (n: number): string =>
    n === 1 ? '1 agent working' : `${String(n)} agents working`,
  agentsTotal: (n: number): string =>
    n === 1 ? '1 agent in the office' : `${String(n)} agents in the office`,
  connection: {
    connecting: 'Connecting…',
    live: 'Live',
    reconnecting: 'Reconnecting…',
    busy: 'Busy: updates every few minutes',
    closed: (until: string): string => `Office closed until ${until}`,
    demo: 'Demo',
  },
  categories: {
    reading: 'reading',
    coding: 'coding',
    testing: 'running tests',
    vcs: 'using Git',
    terminal: 'in the terminal',
    research: 'researching',
    delegating: 'delegating',
    planning: 'planning',
    designing: 'designing',
    monitoring: 'monitoring',
    integration: 'using a tool',
    working: 'working',
  } satisfies Record<Category, string>,
  statuses: {
    working: 'working',
    thinking: 'thinking',
    waiting: 'waiting',
    idle: 'on a coffee break',
    away: 'away',
  } satisfies Record<RobotStatus, string>,
  feed: {
    title: 'Activity',
    empty: 'Nothing has happened yet.',
    arrived: 'arrived',
    left: 'left',
    now: (what: string): string => `is ${what}`,
    started: (category: string): string => `started ${category}`,
    showMore: 'Show more',
    showLess: 'Show less',
  },
  publicWork: {
    title: 'Building in public',
    description: 'What Claude is working on in public projects.',
    empty: 'No public project is active right now.',
  },
  today: {
    title: 'Today',
    description: 'Tool use per room since 00:00 UTC.',
    empty: 'No activity yet today.',
    room: 'Room',
    category: 'Activity',
    count: 'Count',
  },
  list: {
    title: 'Everyone in the office',
    caption: 'Every agent in the office, with what it is doing.',
    empty: 'The office is empty.',
    who: 'Agent',
    room: 'Room',
    status: 'Status',
    goal: 'Current task',
    since: 'For',
  },
  privacy: {
    title: 'Private by design',
    body: 'Private projects share only which agent, what kind of work and when. File paths, commands, prompts and private project names never leave the owner’s machine.',
  },
  duration: (seconds: number): string => {
    if (seconds < 60) return 'under a minute';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? '1 minute' : `${String(minutes)} minutes`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour' : `${String(hours)} hours`;
  },
} as const;
