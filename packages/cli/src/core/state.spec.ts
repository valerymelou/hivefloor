import { describe, expect, it } from 'vitest';
import { parseAgentState, parseSessionState } from './state.js';

describe('state files', () => {
  it('reads a full session state', () => {
    const state = {
      v: 1,
      seq: 3,
      saltDay: '2026-11-08',
      last: { kind: 'tool', cat: 'coding', goal: 'Ship it', at: 100 },
      goal: {
        title: 'T',
        tasks: [{ id: '1', subject: 'S' }, { id: 2 }],
        activeTask: '1',
        todo: 'D',
      },
    };
    expect(parseSessionState(state)).toEqual({
      ...state,
      goal: { ...state.goal, tasks: [{ id: '1', subject: 'S' }] },
    });
  });

  it('drops malformed parts and rejects malformed files', () => {
    expect(
      parseSessionState({
        v: 1,
        seq: 0,
        saltDay: '2026-11-08',
        last: { kind: 'nope', at: 1 },
        goal: 'x',
      }),
    ).toEqual({
      v: 1,
      seq: 0,
      saltDay: '2026-11-08',
      goal: { tasks: [] },
    });
    expect(
      parseSessionState({
        v: 1,
        seq: 0,
        saltDay: '2026-11-08',
        last: { kind: 'tool', at: 1, cat: 'bad' },
        goal: { tasks: 'x' },
      }),
    ).toEqual({
      v: 1,
      seq: 0,
      saltDay: '2026-11-08',
      last: { kind: 'tool', at: 1 },
      goal: { tasks: [] },
    });
    expect(parseSessionState(undefined)).toBeUndefined();
    expect(parseSessionState({ v: 1, seq: -1, saltDay: '2026-11-08' })).toBeUndefined();
    expect(parseSessionState({ v: 2, seq: 0, saltDay: '2026-11-08' })).toBeUndefined();
    expect(parseSessionState({ v: 1, seq: 0, saltDay: 'today' })).toBeUndefined();
  });

  it('reads agent state', () => {
    expect(parseAgentState({ v: 1, seq: 2 })).toEqual({ v: 1, seq: 2 });
    expect(parseAgentState({ v: 1, seq: 'x' })).toBeUndefined();
    expect(parseAgentState([])).toBeUndefined();
  });
});
