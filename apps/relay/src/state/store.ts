import { CATEGORIES, ROBOT_STATUSES, type Category, type RobotStatus } from '@hivefloor/schema';
import type { Departed, OfficeState, RobotRecord, RoomRecord, TodayRecord } from './model.js';

/** Schema migrations, applied in order; the index + 1 is the schema version. */
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, grp TEXT,
     slot INTEGER NOT NULL, rows INTEGER NOT NULL, surplus_since INTEGER, empty_since INTEGER);
   CREATE TABLE robots (key TEXT PRIMARY KEY, parent TEXT, role TEXT NOT NULL, room TEXT NOT NULL,
     desk INTEGER, seat INTEGER, goal TEXT, status TEXT NOT NULL, cat TEXT, since INTEGER NOT NULL,
     last_seq INTEGER NOT NULL, last_event_at INTEGER NOT NULL);
   CREATE TABLE today (room TEXT NOT NULL, cat TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (room, cat));
   CREATE TABLE departed (key TEXT PRIMARY KEY, seq INTEGER NOT NULL, at INTEGER NOT NULL);
   CREATE TABLE seen (signature TEXT PRIMARY KEY, at INTEGER NOT NULL);`,
];

/** The schema version this code expects. */
export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Creates or upgrades the tables. Safe to run on every start.
 *
 * @param sql - The Durable Object's SQL storage.
 */
export function migrate(sql: SqlStorage): void {
  sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const row = sql
    .exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'")
    .toArray()[0];
  const current = row === undefined ? 0 : Number(row.value);
  for (let version = current; version < MIGRATIONS.length; version++) {
    const statements = (MIGRATIONS[version] ?? '').replace(
      'CREATE TABLE meta',
      'CREATE TABLE IF NOT EXISTS meta',
    );
    sql.exec(statements);
  }
  sql.exec(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)",
    String(MIGRATIONS.length),
  );
}

type Row = Record<string, SqlStorageValue>;

const text = (value: SqlStorageValue): string | undefined =>
  typeof value === 'string' ? value : undefined;
const int = (value: SqlStorageValue): number | undefined =>
  typeof value === 'number' ? value : undefined;
const str = (value: SqlStorageValue | undefined): string =>
  typeof value === 'string' ? value : '';
const categories: readonly string[] = CATEGORIES;
const statuses: readonly string[] = ROBOT_STATUSES;
const opt = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;

function roomFrom(row: Row): RoomRecord {
  return {
    id: str(row['id']),
    name: str(row['name']),
    color: str(row['color']),
    slot: Number(row['slot']),
    rows: Number(row['rows']),
    ...opt('group', text(row['grp'] ?? null)),
    ...opt('surplusSince', int(row['surplus_since'] ?? null)),
    ...opt('emptySince', int(row['empty_since'] ?? null)),
  };
}

function robotFrom(row: Row): RobotRecord {
  const cat = text(row['cat'] ?? null);
  const status = str(row['status']);
  return {
    key: str(row['key']),
    role: str(row['role']),
    room: str(row['room']),
    status: (statuses.includes(status) ? status : 'away') as RobotStatus,
    since: Number(row['since']),
    lastSeq: Number(row['last_seq']),
    lastEventAt: Number(row['last_event_at']),
    ...opt('parent', text(row['parent'] ?? null)),
    ...opt('desk', int(row['desk'] ?? null)),
    ...opt('seat', int(row['seat'] ?? null)),
    ...opt('goal', text(row['goal'] ?? null)),
    ...opt('cat', cat !== undefined && categories.includes(cat) ? (cat as Category) : undefined),
  };
}

/**
 * Loads the office state.
 *
 * @param sql - The Durable Object's SQL storage.
 * @param fallbackDay - The day to use when none is stored yet.
 * @returns The stored state.
 */
export function load(sql: SqlStorage, fallbackDay: string): OfficeState {
  const day =
    sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'day'").toArray()[0]?.value ??
    fallbackDay;
  return {
    day,
    rooms: sql.exec<Row>('SELECT * FROM rooms').toArray().map(roomFrom),
    robots: sql.exec<Row>('SELECT * FROM robots').toArray().map(robotFrom),
    today: sql
      .exec<Row>('SELECT * FROM today')
      .toArray()
      .map((row): TodayRecord => ({
        room: str(row['room']),
        cat: str(row['cat']) as Category,
        n: Number(row['n']),
      })),
    departed: sql
      .exec<Row>('SELECT * FROM departed')
      .toArray()
      .map((row): Departed => ({
        key: str(row['key']),
        seq: Number(row['seq']),
        at: Number(row['at']),
      })),
  };
}

function diff<T>(before: readonly T[], after: readonly T[], id: (item: T) => string) {
  const old = new Map(before.map((item) => [id(item), JSON.stringify(item)]));
  const upserts = after.filter((item) => old.get(id(item)) !== JSON.stringify(item));
  const kept = new Set(after.map(id));
  const deletes = [...old.keys()].filter((key) => !kept.has(key));
  return { upserts, deletes };
}

/**
 * Writes only what changed between two states, so a typical event costs one or
 * two row writes (the free plan counts rows written per day).
 *
 * @param sql - The Durable Object's SQL storage.
 * @param before - The state as stored.
 * @param after - The new state.
 * @returns How many rows were written or deleted.
 */
export function persist(sql: SqlStorage, before: OfficeState, after: OfficeState): number {
  let writes = 0;
  if (before.day !== after.day) {
    sql.exec("INSERT OR REPLACE INTO meta (key, value) VALUES ('day', ?)", after.day);
    writes++;
  }
  const rooms = diff(before.rooms, after.rooms, (r) => r.id);
  for (const r of rooms.upserts) {
    sql.exec(
      'INSERT OR REPLACE INTO rooms (id, name, color, grp, slot, rows, surplus_since, empty_since) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      r.id,
      r.name,
      r.color,
      r.group ?? null,
      r.slot,
      r.rows,
      r.surplusSince ?? null,
      r.emptySince ?? null,
    );
  }
  for (const id of rooms.deletes) sql.exec('DELETE FROM rooms WHERE id = ?', id);
  const robots = diff(before.robots, after.robots, (r) => r.key);
  for (const r of robots.upserts) {
    sql.exec(
      'INSERT OR REPLACE INTO robots (key, parent, role, room, desk, seat, goal, status, cat, since, last_seq, last_event_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      r.key,
      r.parent ?? null,
      r.role,
      r.room,
      r.desk ?? null,
      r.seat ?? null,
      r.goal ?? null,
      r.status,
      r.cat ?? null,
      r.since,
      r.lastSeq,
      r.lastEventAt,
    );
  }
  for (const key of robots.deletes) sql.exec('DELETE FROM robots WHERE key = ?', key);
  const today = diff(before.today, after.today, (c) => `${c.room}\u0000${c.cat}`);
  if (after.today.length === 0 && before.today.length > 0) {
    sql.exec('DELETE FROM today');
  } else {
    for (const c of today.upserts)
      sql.exec('INSERT OR REPLACE INTO today (room, cat, n) VALUES (?, ?, ?)', c.room, c.cat, c.n);
    for (const key of today.deletes) {
      const [room = '', cat = ''] = key.split('\u0000');
      sql.exec('DELETE FROM today WHERE room = ? AND cat = ?', room, cat);
    }
  }
  const departed = diff(before.departed, after.departed, (d) => d.key);
  for (const d of departed.upserts)
    sql.exec('INSERT OR REPLACE INTO departed (key, seq, at) VALUES (?, ?, ?)', d.key, d.seq, d.at);
  for (const key of departed.deletes) sql.exec('DELETE FROM departed WHERE key = ?', key);
  writes +=
    rooms.upserts.length + rooms.deletes.length + robots.upserts.length + robots.deletes.length;
  writes +=
    today.upserts.length + today.deletes.length + departed.upserts.length + departed.deletes.length;
  return writes;
}

/**
 * Replay protection (R2): records a signature and tells whether it was seen in
 * the last `windowSec` seconds. Older signatures are forgotten.
 *
 * @param sql - The Durable Object's SQL storage.
 * @param signature - The request's hex signature.
 * @param now - Unix seconds.
 * @param windowSec - How long a signature is remembered.
 * @returns `true` when the signature is a replay.
 */
export function seenBefore(
  sql: SqlStorage,
  signature: string,
  now: number,
  windowSec: number,
): boolean {
  sql.exec('DELETE FROM seen WHERE at < ?', now - windowSec);
  if (sql.exec('SELECT 1 FROM seen WHERE signature = ?', signature).toArray().length > 0)
    return true;
  sql.exec('INSERT INTO seen (signature, at) VALUES (?, ?)', signature, now);
  return false;
}
