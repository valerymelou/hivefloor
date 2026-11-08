import type { Category, EventKind, IngestEventInput } from '@hivefloor/schema';

/** The facts an ingest event is built from. */
export interface EventFacts {
  readonly t: number;
  readonly seq: number;
  readonly sid: string;
  readonly aid?: string;
  readonly role: string;
  readonly kind: EventKind;
  readonly cat?: Category;
  readonly project?: string;
  readonly goal?: string;
}

/**
 * Builds an ingest event field by field (C3). Only fields of the contract are
 * written, each from an explicit value, so nothing from a hook payload can ride
 * along. `goal` is only kept together with `project`.
 *
 * @param facts - The values to send.
 * @returns A new event object.
 */
export function buildEvent(facts: EventFacts): IngestEventInput {
  const event: { -readonly [K in keyof IngestEventInput]: IngestEventInput[K] } = {
    v: 1,
    t: facts.t,
    seq: facts.seq,
    sid: facts.sid,
    role: facts.role,
    kind: facts.kind,
  };
  if (facts.aid !== undefined) event.aid = facts.aid;
  if (facts.kind === 'tool' && facts.cat !== undefined) event.cat = facts.cat;
  if (facts.project !== undefined) {
    event.project = facts.project;
    if (facts.goal !== undefined) event.goal = facts.goal;
  }
  return event;
}

/**
 * Rounds a timestamp down to the owner's rounding step, so exact activity times
 * don't leave the machine.
 *
 * @param nowSec - Unix seconds.
 * @param stepSec - `timestampRoundingSec` from the machine config.
 * @returns The rounded timestamp.
 */
export function roundTimestamp(nowSec: number, stepSec: number): number {
  return Math.floor(nowSec / stepSec) * stepSec;
}
