import {
  type EventKind,
  type IngestEvent,
  lowestFree,
  nextRows,
  type OfficeConfig,
  PRIVATE_ROOM_ID,
  projectColor,
  repackSlots,
  type RobotStatus,
  shouldCloseRoom,
  slugify,
  type ViewerMessageInput,
} from '@hivefloor/schema';
import { DEPARTED_TTL_SEC, type OfficeState, type RobotRecord, type RoomRecord } from './model.js';
import { robotView, roomView, snapshotView } from './view.js';

/** A new state and the messages to send to every visitor. */
export interface Change {
  readonly state: OfficeState;
  readonly messages: readonly ViewerMessageInput[];
}

const day = (now: number): string => new Date(now * 1000).toISOString().slice(0, 10);

const STATUS_FOR: Readonly<Record<Exclude<EventKind, 'end' | 'done'>, RobotStatus>> = {
  start: 'waiting',
  thinking: 'thinking',
  tool: 'working',
  idle: 'waiting',
  spawn: 'thinking',
};

/**
 * A new, empty office: just the private room when it is visible (E1, H3).
 *
 * @param config - The office config.
 * @param now - Unix seconds.
 * @returns The state.
 */
export function emptyOffice(config: OfficeConfig, now: number): OfficeState {
  return {
    day: day(now),
    rooms: ensurePrivateRoom([], config),
    robots: [],
    today: [],
    departed: [],
  };
}

function ensurePrivateRoom(rooms: readonly RoomRecord[], config: OfficeConfig): RoomRecord[] {
  if (!config.privateRoom.visible || rooms.some((room) => room.id === PRIVATE_ROOM_ID))
    return [...rooms];
  const { name, color } = config.privateRoom;
  return [
    ...rooms,
    { id: PRIVATE_ROOM_ID, name, color, slot: lowestFree(rooms.map((r) => r.slot)), rows: 1 },
  ];
}

function newRoom(
  id: string,
  project: string | undefined,
  rooms: readonly RoomRecord[],
  config: OfficeConfig,
): RoomRecord {
  const slot = lowestFree(rooms.map((room) => room.slot));
  if (project === undefined)
    return { id, name: config.privateRoom.name, color: config.privateRoom.color, slot, rows: 1 };
  const entry = config.publicProjects.find((p) => p.name === project);
  return {
    id,
    name: project,
    color: projectColor(project, entry?.color),
    slot,
    rows: 1,
    ...(entry?.group === undefined ? {} : { group: entry.group }),
  };
}

/** Recomputes rows (E5, H14) and empty time (E2) for one room after robots moved. */
function settleRoom(
  room: RoomRecord,
  robots: readonly RobotRecord[],
  now: number,
  config: OfficeConfig,
): RoomRecord {
  const inRoom = robots.filter((robot) => robot.room === room.id);
  const desks = inRoom.flatMap((robot) => (robot.desk === undefined ? [] : [robot.desk]));
  const rows = nextRows(
    {
      rows: room.rows,
      ...(room.surplusSince === undefined ? {} : { surplusSince: room.surplusSince }),
    },
    desks,
    now,
    config.layout,
  );
  const emptySince = inRoom.length > 0 ? undefined : (room.emptySince ?? now);
  const { surplusSince: _s, emptySince: _e, ...base } = room;
  return {
    ...base,
    rows: rows.rows,
    ...(rows.surplusSince === undefined ? {} : { surplusSince: rows.surplusSince }),
    ...(emptySince === undefined ? {} : { emptySince }),
  };
}

/** Settles every room and returns room messages for the ones visitors see differently. */
function settleRooms(
  before: OfficeState,
  robots: readonly RobotRecord[],
  rooms: readonly RoomRecord[],
  now: number,
  config: OfficeConfig,
) {
  const settled = rooms.map((room) => settleRoom(room, robots, now, config));
  const messages: ViewerMessageInput[] = [];
  for (const room of settled) {
    const old = before.rooms.find((r) => r.id === room.id);
    const view = roomView(room, robots, config.layout.roomsPerFloor);
    if (
      old === undefined ||
      JSON.stringify(roomView(old, before.robots, config.layout.roomsPerFloor)) !==
        JSON.stringify(view)
    ) {
      messages.push({ type: 'room', v: 1, room: view });
    }
  }
  return { rooms: settled, messages };
}

/** Repacks room slots when the office is empty (H13); visitors get a fresh snapshot. */
function repackIfEmpty(change: Change, now: number, config: OfficeConfig): Change {
  const { state } = change;
  if (state.robots.length > 0) return change;
  const packed = repackSlots(state.rooms.map((room) => room.id));
  if (packed.every(({ id, slot }) => state.rooms.find((r) => r.id === id)?.slot === slot))
    return change;
  const rooms = state.rooms.map((room) => ({
    ...room,
    slot: packed.find((p) => p.id === room.id)?.slot ?? room.slot,
  }));
  const next = { ...state, rooms };
  return { state: next, messages: [snapshotView(next, now, config.layout.roomsPerFloor)] };
}

function remove(
  state: OfficeState,
  keys: readonly string[],
  seqOf: (robot: RobotRecord) => number,
  now: number,
  config: OfficeConfig,
): Change {
  const leaving = state.robots.filter((robot) => keys.includes(robot.key));
  const robots = state.robots.filter((robot) => !keys.includes(robot.key));
  const departed = [
    ...state.departed.filter((d) => !keys.includes(d.key)),
    ...leaving.map((robot) => ({ key: robot.key, seq: seqOf(robot), at: now })),
  ];
  const settled = settleRooms(state, robots, state.rooms, now, config);
  const next = { ...state, robots, rooms: settled.rooms, departed };
  const messages = [
    ...leaving.map((robot): ViewerMessageInput => ({ type: 'leave', v: 1, key: robot.key })),
    ...settled.messages,
  ];
  return repackIfEmpty({ state: next, messages }, now, config);
}

function place(
  robot: Omit<RobotRecord, 'desk' | 'seat'>,
  others: readonly RobotRecord[],
): RobotRecord {
  const sameRoom = others.filter((r) => r.room === robot.room && r.key !== robot.key);
  if (robot.parent === undefined)
    return {
      ...robot,
      desk: lowestFree(sameRoom.flatMap((r) => (r.desk === undefined ? [] : [r.desk]))),
    };
  return {
    ...robot,
    seat: lowestFree(sameRoom.flatMap((r) => (r.seat === undefined ? [] : [r.seat]))),
  };
}

function countTool(state: OfficeState, room: string, event: IngestEvent): OfficeState['today'] {
  if (event.kind !== 'tool' || event.cat === undefined) return state.today;
  const cat = event.cat;
  const found = state.today.some((c) => c.room === room && c.cat === cat);
  return found
    ? state.today.map((c) => (c.room === room && c.cat === cat ? { ...c, n: c.n + 1 } : c))
    : [...state.today, { room, cat, n: 1 }];
}

/**
 * Applies one verified ingest event (R3): opens rooms, seats robots at desks or
 * the team table through the shared layout helpers (E1–E7), ignores stale
 * `seq` values (H5), removes robots on `end`/`done` (H9) and counts tool use.
 *
 * @param state - The office state.
 * @param event - A verified event.
 * @param now - Relay time in Unix seconds.
 * @param config - The office config.
 * @returns The new state and the messages for visitors.
 */
export function applyEvent(
  state: OfficeState,
  event: IngestEvent,
  now: number,
  config: OfficeConfig,
): Change {
  const isPrivate = event.project === undefined;
  if (isPrivate && !config.privateRoom.visible) return { state, messages: [] };
  const key = event.aid === undefined ? event.sid : `${event.sid}:${event.aid}`;
  const existing = state.robots.find((robot) => robot.key === key);
  const departed = state.departed.find((d) => d.key === key);
  if (
    (existing !== undefined && event.seq <= existing.lastSeq) ||
    (departed !== undefined && event.seq <= departed.seq)
  ) {
    return { state, messages: [] };
  }
  if (event.kind === 'end' || event.kind === 'done') {
    const keys = [
      key,
      ...state.robots.filter((robot) => robot.parent === key).map((robot) => robot.key),
    ];
    const gone = remove(
      state,
      keys,
      (robot) => (robot.key === key ? event.seq : robot.lastSeq),
      now,
      config,
    );
    return existing === undefined
      ? {
          state: {
            ...gone.state,
            departed: gone.state.departed.some((d) => d.key === key)
              ? gone.state.departed
              : [...gone.state.departed, { key, seq: event.seq, at: now }],
          },
          messages: gone.messages,
        }
      : gone;
  }

  const parent = event.aid === undefined ? undefined : event.sid;
  const parentRobot =
    parent === undefined ? undefined : state.robots.find((robot) => robot.key === parent);
  const roomId = parentRobot?.room ?? (isPrivate ? PRIVATE_ROOM_ID : slugify(event.project ?? ''));
  const rooms = ensurePrivateRoom(state.rooms, config);
  const withRoom = rooms.some((room) => room.id === roomId)
    ? rooms
    : [...rooms, newRoom(roomId, event.project, rooms, config)];

  const status = STATUS_FOR[event.kind];
  const moved = existing !== undefined && existing.room !== roomId;
  const base = {
    key,
    role: event.role,
    room: roomId,
    status,
    since: existing === undefined || moved || existing.status !== status ? now : existing.since,
    lastSeq: event.seq,
    lastEventAt: now,
    ...(parent === undefined ? {} : { parent }),
    ...(event.goal === undefined || parent !== undefined ? {} : { goal: event.goal }),
    ...(event.kind === 'tool' && event.cat !== undefined ? { cat: event.cat } : {}),
  };
  const others = state.robots.filter((robot) => robot.key !== key);
  const robot =
    existing === undefined || moved
      ? place(base, others)
      : {
          ...base,
          ...(existing.desk === undefined ? {} : { desk: existing.desk }),
          ...(existing.seat === undefined ? {} : { seat: existing.seat }),
        };
  const robots = [...others, robot];
  const settled = settleRooms(state, robots, withRoom, now, config);
  const next: OfficeState = {
    ...state,
    rooms: settled.rooms,
    robots,
    today: countTool(state, roomId, event),
    departed: state.departed.filter((d) => d.key !== key),
  };
  const changed =
    existing === undefined ||
    JSON.stringify(robotView(existing)) !== JSON.stringify(robotView(robot));
  const delta: ViewerMessageInput[] = changed
    ? [{ type: 'delta', v: 1, robot: robotView(robot) }]
    : [];
  // Visitors keep today's counts current without polling (R8).
  const count = next.today.find((c) => c.room === roomId && c.cat === event.cat);
  const today: ViewerMessageInput[] =
    next.today !== state.today && count !== undefined ? [{ type: 'today', v: 1, count }] : [];
  return { state: next, messages: [...settled.messages, ...delta, ...today] };
}

/**
 * Presence and housekeeping, run by the alarm (R5): idle after `idleAfterSec`,
 * away after `awayAfterSec`, leaving after `leaveAfterSec`; subagents of a
 * departed session leave too; trailing empty rows go (H14) and empty rooms close
 * (E2).
 *
 * @param state - The office state.
 * @param now - Unix seconds.
 * @param config - The office config.
 * @returns The new state and the messages for visitors.
 */
export function tick(state: OfficeState, now: number, config: OfficeConfig): Change {
  const { idleAfterSec, awayAfterSec, leaveAfterSec } = config.presence;
  const departedKeys = new Set(state.departed.map((d) => d.key));
  const leaving = state.robots
    .filter(
      (robot) =>
        now - robot.lastEventAt >= leaveAfterSec ||
        (robot.parent !== undefined && departedKeys.has(robot.parent)),
    )
    .map((robot) => robot.key);
  const afterLeave =
    leaving.length > 0
      ? remove(state, leaving, (robot) => robot.lastSeq, now, config)
      : { state, messages: [] };

  const messages: ViewerMessageInput[] = [...afterLeave.messages];
  const robots = afterLeave.state.robots.map((robot): RobotRecord => {
    const silent = now - robot.lastEventAt;
    const status: RobotStatus =
      silent >= awayAfterSec
        ? 'away'
        : silent >= idleAfterSec && robot.status !== 'away'
          ? 'idle'
          : robot.status;
    if (status === robot.status) return robot;
    const { cat: _cat, ...rest } = robot;
    const updated = { ...rest, status, since: now };
    messages.push({ type: 'delta', v: 1, robot: robotView(updated) });
    return updated;
  });

  const settled = settleRooms(afterLeave.state, robots, afterLeave.state.rooms, now, config);
  messages.push(...settled.messages);
  const closing = settled.rooms.filter((room) =>
    shouldCloseRoom(
      {
        id: room.id,
        robotCount: robots.filter((r) => r.room === room.id).length,
        ...(room.emptySince === undefined ? {} : { emptySince: room.emptySince }),
      },
      now,
      config.layout,
    ),
  );
  for (const room of closing) messages.push({ type: 'roomClosed', v: 1, id: room.id });
  const next: OfficeState = {
    ...afterLeave.state,
    robots,
    rooms: settled.rooms.filter((room) => !closing.includes(room)),
    departed: afterLeave.state.departed.filter((d) => now - d.at < DEPARTED_TTL_SEC),
  };
  return { state: next, messages };
}

/**
 * Starts a new UTC day if needed (R8): today's counts reset and room slots are
 * repacked (H13). Visitors then get a fresh snapshot.
 *
 * @param state - The office state.
 * @param now - Unix seconds.
 * @param config - The office config.
 * @returns The new state and, on a new day, a snapshot message.
 */
export function rollDay(state: OfficeState, now: number, config: OfficeConfig): Change {
  const today = day(now);
  if (state.day === today) return { state, messages: [] };
  const packed = repackSlots(state.rooms.map((room) => room.id));
  const rooms = state.rooms.map((room) => ({
    ...room,
    slot: packed.find((p) => p.id === room.id)?.slot ?? room.slot,
  }));
  const next: OfficeState = { ...state, day: today, today: [], rooms };
  return { state: next, messages: [snapshotView(next, now, config.layout.roomsPerFloor)] };
}

/**
 * When the alarm should next run, or `undefined` when nothing is pending, so no
 * alarm runs while the office is empty (R5).
 *
 * Only times after `now` count: an alarm set in the past fires at once, and each
 * firing is a Durable Object request, so a threshold that has already been
 * handled must never be scheduled again. The one exception is 0, which asks for
 * an immediate wake to remove subagents of a departed session; that tick clears it.
 *
 * @param state - The office state.
 * @param config - The office config.
 * @param now - Unix seconds.
 * @returns Unix seconds, or `undefined`.
 */
export function nextWake(
  state: OfficeState,
  config: OfficeConfig,
  now: number,
): number | undefined {
  const { idleAfterSec, awayAfterSec, leaveAfterSec } = config.presence;
  const times: number[] = [];
  for (const robot of state.robots) {
    for (const after of [idleAfterSec, awayAfterSec, leaveAfterSec])
      times.push(robot.lastEventAt + after);
    if (robot.parent !== undefined && state.departed.some((d) => d.key === robot.parent))
      times.push(0);
  }
  for (const room of state.rooms) {
    if (room.surplusSince !== undefined)
      times.push(room.surplusSince + config.layout.rowRemoveAfterSec);
    if (room.emptySince !== undefined && room.id !== PRIVATE_ROOM_ID)
      times.push(room.emptySince + config.layout.roomCloseAfterSec);
  }
  const pending = times.filter((t) => t > now || t === 0);
  return pending.length === 0 ? undefined : Math.min(...pending);
}
