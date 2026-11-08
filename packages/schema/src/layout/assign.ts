import { PRIVATE_ROOM_ID } from '../constants.js';
import type { LayoutLimits } from '../office-config.js';
import { compareText } from '../text.js';

/**
 * The lowest non-negative integer not in `taken`. Used for room slots, desks and
 * table seats, so freed places are reused first (E3).
 *
 * @param taken - Places already in use, in any order.
 * @returns The first free place.
 *
 * @example
 * ```ts
 * lowestFree([0, 1, 3]); // 2
 * ```
 */
export function lowestFree(taken: Iterable<number>): number {
  const used = new Set(taken);
  let candidate = 0;
  while (used.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/** Where a slot sits in the building. */
export interface SlotPosition {
  /** Floor, from 0 at ground level (E4). */
  readonly floor: number;
  /** Bay along the corridor on that floor, from 0 (E3). */
  readonly bay: number;
  /** Side of the corridor (E3). */
  readonly side: 'left' | 'right';
}

/**
 * Maps a room slot to its floor, bay and side. Rooms sit in pairs on either side
 * of the corridor, one pair per bay, `roomsPerFloor` rooms per floor.
 *
 * @param slot - The room's slot.
 * @param limits - The office's layout limits.
 * @returns The slot's position.
 */
export function slotPosition(
  slot: number,
  limits: Pick<LayoutLimits, 'roomsPerFloor'>,
): SlotPosition {
  const onFloor = slot % limits.roomsPerFloor;
  return {
    floor: Math.floor(slot / limits.roomsPerFloor),
    bay: Math.floor(onFloor / 2),
    side: onFloor % 2 === 0 ? 'left' : 'right',
  };
}

/**
 * Gives every room a slot from scratch, packing them from slot 0. Only the relay
 * does this, at the daily reset or when the office is empty (E3, H13). The private
 * room comes first, then rooms by id, so the result doesn't depend on input order.
 *
 * @param roomIds - The ids of the open rooms.
 * @returns Each room id with its new slot, in slot order.
 */
export function repackSlots(roomIds: readonly string[]): { id: string; slot: number }[] {
  const unique = [...new Set(roomIds)];
  const rest = unique.filter((id) => id !== PRIVATE_ROOM_ID).sort(compareText);
  const ordered = unique.includes(PRIVATE_ROOM_ID) ? [PRIVATE_ROOM_ID, ...rest] : rest;
  return ordered.map((id, slot) => ({ id, slot }));
}

/**
 * The number of desk rows a room needs so every taken desk exists: at least one,
 * at most `maxRowsPerRoom` (E5). Desks beyond the last row are overflow.
 *
 * @param takenDesks - Desk numbers of the robots in the room.
 * @param limits - The office's layout limits.
 * @returns The row count.
 */
export function rowsNeeded(
  takenDesks: Iterable<number>,
  limits: Pick<LayoutLimits, 'desksPerRow' | 'maxRowsPerRoom'>,
): number {
  let highest = -1;
  for (const desk of takenDesks) {
    highest = Math.max(highest, desk);
  }
  const rows = Math.ceil((highest + 1) / limits.desksPerRow);
  return Math.min(limits.maxRowsPerRoom, Math.max(1, rows));
}

/** A room's desk rows and when its trailing rows became unused. */
export interface RowState {
  readonly rows: number;
  /** When the room first had more rows than it needed; absent while it doesn't. */
  readonly surplusSince?: number;
}

/**
 * Grows or shrinks a room's desk rows. A room grows at once when a robot needs a
 * desk in a new row. It shrinks only by removing trailing empty rows, and only
 * after they have been unused for `rowRemoveAfterSec`, so a seated robot never
 * moves (E5, H14).
 *
 * @param state - The room's current rows.
 * @param takenDesks - Desk numbers of the robots in the room now.
 * @param now - The current time in Unix seconds.
 * @param limits - The office's layout limits.
 * @returns The room's new rows.
 */
export function nextRows(
  state: RowState,
  takenDesks: Iterable<number>,
  now: number,
  limits: Pick<LayoutLimits, 'desksPerRow' | 'maxRowsPerRoom' | 'rowRemoveAfterSec'>,
): RowState {
  const needed = rowsNeeded(takenDesks, limits);
  if (state.rows <= needed) {
    return { rows: needed };
  }
  const surplusSince = state.surplusSince ?? now;
  if (now - surplusSince >= limits.rowRemoveAfterSec) {
    return { rows: needed };
  }
  return { rows: state.rows, surplusSince };
}

/**
 * Tells whether an empty room should close and free its slot (E2). The private
 * room never closes.
 *
 * @param room - The room's id, robot count and when it became empty.
 * @param now - The current time in Unix seconds.
 * @param limits - The office's layout limits.
 * @returns `true` when the room has been empty for `roomCloseAfterSec`.
 */
export function shouldCloseRoom(
  room: { readonly id: string; readonly robotCount: number; readonly emptySince?: number },
  now: number,
  limits: Pick<LayoutLimits, 'roomCloseAfterSec'>,
): boolean {
  if (room.id === PRIVATE_ROOM_ID || room.robotCount > 0 || room.emptySince === undefined) {
    return false;
  }
  return now - room.emptySince >= limits.roomCloseAfterSec;
}
