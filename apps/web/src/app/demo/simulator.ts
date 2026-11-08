import {
  CATEGORIES,
  lowestFree,
  PRIVATE_ROOM_ID,
  projectColor,
  rowsNeeded,
  slugify,
  type Category,
  type OfficeConfig,
  type ViewerMessageInput,
  type RobotInput,
  type RoomInput,
} from '@hivefloor/schema';

/** A small deterministic random generator (mulberry32), so demos and tests repeat. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOALS = [
  'Building the paywall screen',
  'Fixing the login flow',
  'Writing the onboarding docs',
  'Adding dark mode',
  'Speeding up the build',
];
const SUBAGENTS = ['Explore', 'Plan', 'code-reviewer'];

/**
 * Simulates an office for demo mode (W7): sessions arrive and leave, switch
 * tools, delegate to subagents and take coffee breaks. It emits exactly the
 * messages the relay would, so the app can't tell the difference.
 */
export class Simulator {
  private readonly rooms: RoomInput[] = [];
  private robots: RobotInput[] = [];
  private readonly counts = new Map<string, number>();

  /**
   * @param config - The office config to simulate (public projects, layout).
   * @param random - A random generator, such as {@link seededRandom}.
   */
  constructor(
    private readonly config: OfficeConfig,
    private readonly random: () => number,
  ) {}

  private pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)] as T;
  }

  private hex(): string {
    return Math.floor(this.random() * 0xffffff)
      .toString(16)
      .padStart(6, '0');
  }

  private room(project: string | undefined, out: ViewerMessageInput[]): string {
    const id = project === undefined ? PRIVATE_ROOM_ID : slugify(project);
    if (!this.rooms.some((r) => r.id === id)) {
      const entry = this.config.publicProjects.find((p) => p.name === project);
      const slot = lowestFree(this.rooms.map((r) => r.slot));
      const room: RoomInput = {
        id,
        name: project ?? this.config.privateRoom.name,
        color:
          project === undefined
            ? this.config.privateRoom.color
            : projectColor(project, entry?.color),
        slot,
        floor: Math.floor(slot / this.config.layout.roomsPerFloor),
        rows: 1,
        lit: true,
      };
      this.rooms.push(room);
      out.push({ type: 'room', v: 1, room });
    }
    return id;
  }

  private arrive(now: number, out: ViewerMessageInput[]): void {
    const projects = this.config.publicProjects.map((p) => p.name);
    const project = this.random() < 0.25 || projects.length === 0 ? undefined : this.pick(projects);
    const room = this.room(project, out);
    const desks = this.robots
      .filter((r) => r.room === room && r.desk !== undefined)
      .map((r) => r.desk ?? 0);
    const desk = lowestFree(desks);
    this.growRows(room, [...desks, desk], out);
    const robot: RobotInput = {
      key: this.hex(),
      role: 'claude',
      room,
      desk,
      status: 'working',
      cat: this.pick(CATEGORIES),
      since: now,
      ...(project === undefined ? {} : { goal: this.pick(GOALS) }),
    };
    this.robots.push(robot);
    out.push({ type: 'delta', v: 1, robot });
  }

  /** Adds desk rows when a robot needs a desk in a new row, as the relay does (E5). */
  private growRows(id: string, desks: readonly number[], out: ViewerMessageInput[]): void {
    const index = this.rooms.findIndex((r) => r.id === id);
    const room = this.rooms[index];
    const rows = rowsNeeded(desks, this.config.layout);
    if (room === undefined || rows <= room.rows) return;
    const grown = { ...room, rows };
    this.rooms[index] = grown;
    out.push({ type: 'room', v: 1, room: grown });
  }

  private update(robot: RobotInput, change: Partial<RobotInput>, out: ViewerMessageInput[]): void {
    const next = { ...robot, ...change };
    if (next.status !== 'working') delete next.cat;
    this.robots = this.robots.map((r) => (r.key === robot.key ? next : r));
    out.push({ type: 'delta', v: 1, robot: next });
  }

  private count(room: string, cat: Category, out: ViewerMessageInput[]): void {
    const key = `${room}:${cat}`;
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    out.push({ type: 'today', v: 1, count: { room, cat, n } });
  }

  /**
   * The opening state: a few sessions already at work.
   *
   * @param now - Unix seconds.
   * @returns The snapshot message.
   */
  start(now: number, sessions = 3): ViewerMessageInput {
    const ignored: ViewerMessageInput[] = [];
    this.room(undefined, ignored);
    for (let i = 0; i < sessions; i++) this.arrive(now, ignored);
    return {
      type: 'snapshot',
      v: 1,
      at: now,
      rooms: [...this.rooms],
      robots: [...this.robots],
      today: [],
    };
  }

  /**
   * One tick of simulated activity.
   *
   * @param now - Unix seconds.
   * @returns The messages the relay would send.
   */
  step(now: number): ViewerMessageInput[] {
    const out: ViewerMessageInput[] = [];
    const mains = this.robots.filter((r) => r.parent === undefined);
    const roll = this.random();
    if (mains.length < 2 || (roll < 0.08 && mains.length < 6)) {
      this.arrive(now, out);
    } else if (roll < 0.14 && mains.length > 2) {
      const leaving = this.pick(mains);
      for (const r of this.robots.filter((x) => x.key === leaving.key || x.parent === leaving.key))
        out.push({ type: 'leave', v: 1, key: r.key });
      this.robots = this.robots.filter((x) => x.key !== leaving.key && x.parent !== leaving.key);
    } else if (roll < 0.24) {
      const parent = this.pick(mains);
      // The team table is shared by every session in the room (E6).
      const seats = this.robots
        .filter((r) => r.room === parent.room && r.seat !== undefined)
        .map((r) => r.seat ?? 0);
      const robot: RobotInput = {
        key: `${parent.key}:${this.hex()}`,
        parent: parent.key,
        role: this.pick(SUBAGENTS),
        room: parent.room,
        seat: lowestFree(seats),
        status: 'working',
        cat: 'reading',
        since: now,
      };
      this.robots.push(robot);
      out.push({ type: 'delta', v: 1, robot });
    } else if (roll < 0.32) {
      const subs = this.robots.filter((r) => r.parent !== undefined);
      if (subs.length > 0) {
        const done = this.pick(subs);
        this.robots = this.robots.filter((r) => r.key !== done.key);
        out.push({ type: 'leave', v: 1, key: done.key });
      }
    } else if (roll < 0.4) {
      this.update(
        this.pick(mains),
        { status: this.pick(['thinking', 'waiting', 'idle'] as const), since: now },
        out,
      );
    } else {
      const robot = this.pick(this.robots);
      const cat = this.pick(CATEGORIES);
      this.update(robot, { status: 'working', cat, since: now }, out);
      this.count(robot.room, cat, out);
    }
    return out;
  }
}
