# 0007. One room per project, laid out by a shared pure function

- Status: accepted
- Date: 2026-11-08
- Deciders: Valery Melou

## Context and problem statement

The office should grow and shrink with the work: a room per public project, one shared room for private work, desks added as sessions arrive. Every visitor must see the same robot in the same place, a room must never jump while someone watches, and a busy day must not flood the scene. Who decides where things go, and how do we keep the relay and every browser in agreement?

## Decision drivers

- Same placement for every visitor (E7), with no coordination between browsers.
- Open rooms never move while watched (E3, H13); seated robots never move (H14).
- Bounded rendering cost: at most 40 animated robots and 12 drawn rooms (E8).
- Testable with property-based tests, without a renderer or a Durable Object.

## Considered options

1. **Relay assigns, everyone lays out with one pure function.** The relay assigns room slots, desk and seat numbers and row counts with pure helpers; browsers turn that state into a building with a pure `layout()`. Both live in `packages/schema`.
2. **Relay sends full coordinates.** The relay computes 3D positions and sends them.
3. **Browsers lay out independently** from the robot list, each with its own packing.

## Decision outcome

Chosen option: **1**. Assignment and drawing are split along the line between state and view:

- **Assignment (relay):** `lowestFree` gives a new room the lowest free slot, a new main session the lowest free desk and a subagent the lowest free table seat, so freed places are reused and nothing already placed moves. `rowsNeeded` and `nextRows` grow a room at once when a desk in a new row is needed and remove only trailing empty rows after `rowRemoveAfterSec`. `shouldCloseRoom` closes a room empty for `roomCloseAfterSec`, never the private room. `repackSlots` packs slots from zero (private room first, then by id) and is only used at the daily reset or when the office is empty.
- **Drawing (relay and browsers):** `layout(rooms, occupancy, limits)` maps slots to floor, bay and side (two rooms per bay, `roomsPerFloor` per floor), gives facing rooms the same depth, marks robots beyond the last desk or seat as standing, animates the `maxRenderedRobots` most recently active robots and counts the rest as "+N" per room, and beyond `maxVisibleRooms` folds the quietest rooms into an "Other projects" room that takes the lowest folded slot.
- Ties are broken by slot and by key, compared by code unit, so the result never depends on input order or locale.
- `group` is accepted and passed through but not acted on in v1 (E1).

### Consequences

- Good: browsers never disagree, because they only apply the relay's assignments.
- Good: the rules are plain functions with property tests: rooms never overlap, drawn rooms keep their slots, caps always hold, and shuffling the input changes nothing.
- Bad: folding is the one case where a room visibly changes place (into "Other projects"); it only happens beyond `maxVisibleRooms`.
- Bad: robots beyond 12 desks stand instead of getting a desk; acceptable for v1 and covered by the render caps.

## More information

- PRD: Elastic office rules E1–E9, hardening rules H13 and H14.
- Code: `packages/schema/src/layout/`.
