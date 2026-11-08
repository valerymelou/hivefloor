import { describe, expect, it } from 'vitest';
import { payloads, testConfig } from '../test/payloads.js';
import { cleanGoal, currentGoal, MAX_TASKS, updateGoalState, type GoalState } from './goal.js';

const settings = testConfig().goals;
const empty: GoalState = { tasks: [] };

describe('cleanGoal (H2)', () => {
  it('keeps a plain task title', () => {
    expect(cleanGoal('Building the paywall screen', settings)).toBe('Building the paywall screen');
  });

  it.each([
    'Rotate the API Token',
    'Fix CVE-2026-1234',
    'Patch security headers',
    'Reset PASSWORD flow',
  ])('drops %j (blocked word)', (text) => {
    expect(cleanGoal(text, settings)).toBeUndefined();
  });

  it('drops text with the private prefix', () => {
    expect(cleanGoal('[private] Acme migration', settings)).toBeUndefined();
    expect(cleanGoal('  [PRIVATE] Acme', settings)).toBeUndefined();
  });

  it('strips control characters and links', () => {
    expect(cleanGoal('Ship\nthe\tdocs see https://evil.example/x', settings)).toBe(
      'Ship the docs see',
    );
    expect(cleanGoal('Read docs.example.com/guide now', settings)).toBe('Read now');
  });

  it('cuts to the maximum length with an ellipsis, never splitting a surrogate pair', () => {
    const goal = cleanGoal(`${'a'.repeat(58)}🚀🚀🚀`, settings);
    expect(goal).toBe(`${'a'.repeat(58)}…`);
    expect(goal?.length).toBeLessThanOrEqual(60);
    expect(cleanGoal('🚀'.repeat(40), settings)).toBe(`${'🚀'.repeat(29)}…`);
  });

  it('honours a custom block word and max length', () => {
    const custom = { ...settings, blockWords: ['acme'], maxLength: 10 };
    expect(cleanGoal('ACME onboarding', custom)).toBeUndefined();
    expect(cleanGoal('Write the onboarding guide', custom)).toBe('Write the…');
  });

  it('returns nothing for empty results', () => {
    expect(cleanGoal('   ', settings)).toBeUndefined();
    expect(cleanGoal('https://x.example', settings)).toBeUndefined();
  });
});

describe('goal state (C7)', () => {
  const apply = (state: GoalState, ...events: Record<string, unknown>[]): GoalState =>
    events.reduce<GoalState>((s, p) => updateGoalState(s, p), state);

  it('uses the in-progress task subject', () => {
    const state = apply(
      empty,
      payloads.taskCreated('1', 'Write the onboarding guide'),
      payloads.taskUpdate('1', 'in_progress'),
    );
    expect(currentGoal(state, settings)).toBe('Write the onboarding guide');
  });

  it('falls back to the session title without an active task', () => {
    const state = apply(empty, payloads.sessionStart());
    expect(currentGoal(state, settings)).toBe('Building the paywall screen');
    const working = apply(
      state,
      payloads.taskCreated('1', 'Add tests'),
      payloads.taskUpdate('1', 'in_progress'),
    );
    expect(currentGoal(working, settings)).toBe('Add tests');
    const done = apply(working, payloads.taskCompleted('1'));
    expect(currentGoal(done, settings)).toBe('Building the paywall screen');
  });

  it('hides the goal when the active task is blocked, rather than showing the title', () => {
    const state = apply(
      empty,
      payloads.sessionStart(),
      payloads.taskCreated('1', 'Rotate the token'),
      payloads.taskUpdate('1', 'in_progress'),
    );
    expect(currentGoal(state, settings)).toBeUndefined();
  });

  it('clears the active task when TaskUpdate completes or deletes it', () => {
    const active = apply(
      empty,
      payloads.taskCreated('1', 'A'),
      payloads.taskUpdate('1', 'in_progress'),
    );
    expect(apply(active, payloads.taskUpdate('1', 'completed')).activeTask).toBeUndefined();
    expect(apply(active, payloads.taskUpdate('1', 'deleted')).activeTask).toBeUndefined();
    expect(apply(active, payloads.taskUpdate('2', 'completed')).activeTask).toBe('1');
    expect(apply(active, payloads.taskUpdate('1', 'pending')).activeTask).toBe('1');
  });

  it('reads a subject passed to TaskUpdate and accepts other id field names', () => {
    const state = apply(empty, {
      hook_event_name: 'PreToolUse',
      tool_name: 'TaskUpdate',
      tool_input: { task_id: '9', subject: 'Polish the README', status: 'in_progress' },
    });
    expect(currentGoal(state, settings)).toBe('Polish the README');
    expect(
      apply(empty, {
        hook_event_name: 'PreToolUse',
        tool_name: 'TaskUpdate',
        tool_input: { status: 'x' },
      }),
    ).toEqual(empty);
  });

  it('uses the TodoWrite item in progress when the task tools are off', () => {
    const state = apply(
      empty,
      payloads.todoWrite([
        { content: 'Write tests', status: 'completed', activeForm: 'Writing tests' },
        { content: 'Build the paywall', status: 'in_progress', activeForm: 'Building the paywall' },
      ]),
    );
    expect(currentGoal(state, settings)).toBe('Building the paywall');
    expect(
      apply(state, payloads.todoWrite([{ content: 'x', status: 'completed' }])).todo,
    ).toBeUndefined();
    expect(
      currentGoal(
        apply(empty, payloads.todoWrite([{ content: 'Plan it', status: 'in_progress' }])),
        settings,
      ),
    ).toBe('Plan it');
  });

  it('respects fromTaskList and fromSessionTitle', () => {
    const state = apply(
      empty,
      payloads.sessionStart(),
      payloads.taskCreated('1', 'Task'),
      payloads.taskUpdate('1', 'in_progress'),
    );
    expect(currentGoal(state, { ...settings, fromTaskList: false })).toBe(
      'Building the paywall screen',
    );
    expect(
      currentGoal(state, { ...settings, fromTaskList: false, fromSessionTitle: false }),
    ).toBeUndefined();
  });

  it('remembers at most MAX_TASKS tasks and ignores incomplete TaskCreated payloads', () => {
    let state = empty;
    for (let i = 0; i < MAX_TASKS + 5; i++)
      state = updateGoalState(state, payloads.taskCreated(String(i), `Task ${String(i)}`));
    expect(state.tasks).toHaveLength(MAX_TASKS);
    expect(state.tasks[0]?.id).toBe('5');
    expect(updateGoalState(empty, { hook_event_name: 'TaskCreated', task_id: '1' })).toEqual(empty);
    expect(updateGoalState(empty, { hook_event_name: 'PreToolUse', tool_name: 'Read' })).toEqual(
      empty,
    );
  });
});
