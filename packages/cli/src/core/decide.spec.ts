import fc from 'fast-check';
import { IngestEventSchema, INGEST_EVENT_FIELDS } from '@hivefloor/schema';
import { describe, expect, it } from 'vitest';
import {
  AGENT_ID,
  PATHS,
  payloads,
  PRIVATE_CWD,
  PRIVATE_STRINGS,
  SECRET,
  SESSION_ID,
  testConfig,
} from '../test/payloads.js';
import { decide, type DecideInput, type Decision } from './decide.js';
import { daySalt, shortHash } from './identity.js';
import type { AgentState, SessionState } from './state.js';

const NOW = 1794096003; // 2026-11-08T00:00:03Z
const config = testConfig();
const sid = shortHash(daySalt(SECRET, '2026-11-08'), SESSION_ID);
const aid = shortHash(daySalt(SECRET, '2026-11-08'), AGENT_ID);

const run = (payload: Record<string, unknown>, extra: Partial<DecideInput> = {}): Decision =>
  decide({ payload, config, secret: SECRET, now: NOW, paths: PATHS, ...extra });

/** Runs payloads in order, carrying state like the hook does. */
function replay(list: Record<string, unknown>[], start = NOW, step = 1): Decision[] {
  let session: SessionState | undefined;
  let agent: AgentState | undefined;
  return list.map((payload, i) => {
    const decision = decide({
      payload,
      config,
      secret: SECRET,
      now: start + i * step,
      paths: PATHS,
      ...(session ? { session } : {}),
      ...(agent ? { agent } : {}),
    });
    if (decision.session) session = decision.session;
    if (decision.agent) agent = decision.agent;
    if (decision.remove === 'agent') agent = undefined;
    if (decision.remove === 'session') [session, agent] = [undefined, undefined];
    return decision;
  });
}

describe('decide', () => {
  it('announces a public session with its project and title goal', () => {
    const decision = run(payloads.sessionStart());
    expect(decision.event).toEqual({
      v: 1,
      t: 1794096000,
      seq: 0,
      sid,
      role: 'claude',
      kind: 'start',
      project: 'Ledgerly',
      goal: 'Building the paywall screen',
    });
    expect(decision.session).toMatchObject({ v: 1, seq: 1, saltDay: '2026-11-08' });
  });

  it('sends only robot, kind, category and time for a private project', () => {
    expect(run(payloads.sessionStart(PRIVATE_CWD)).event).toEqual({
      v: 1,
      t: 1794096000,
      seq: 0,
      sid,
      role: 'claude',
      kind: 'start',
    });
    expect(run(payloads.bash('git push', PRIVATE_CWD)).event).toEqual({
      v: 1,
      t: 1794096000,
      seq: 0,
      sid,
      role: 'claude',
      kind: 'tool',
      cat: 'vcs',
    });
  });

  it('maps every lifecycle hook to its kind', () => {
    const kinds = replay([
      payloads.sessionStart(),
      payloads.userPrompt(),
      payloads.tool('Edit'),
      payloads.stop(),
      payloads.sessionEnd(),
    ]).map((d) => d.event?.kind);
    expect(kinds).toEqual(['start', 'thinking', 'tool', 'idle', 'end']);
  });

  it('counts seq per robot (H5)', () => {
    const seqs = replay([
      payloads.sessionStart(),
      payloads.userPrompt(),
      payloads.tool('Edit'),
    ]).map((d) => d.event?.seq);
    expect(seqs).toEqual([0, 1, 2]);
  });

  it('skips a repeated category within 10 s (C8)', () => {
    const decisions = replay(
      [payloads.tool('Edit'), payloads.tool('Write'), payloads.tool('Read')],
      NOW,
      2,
    );
    expect(decisions.map((d) => d.event?.cat)).toEqual(['coding', undefined, 'reading']);
  });

  it('keeps the salt of the day the session started (H7)', () => {
    const [start, later] = replay(
      [payloads.sessionStart(), payloads.tool('Read')],
      NOW,
      86_400 + 3600,
    );
    expect(start?.event?.sid).toBe(later?.event?.sid);
    expect(run(payloads.tool('Read'), { now: NOW + 86_400 }).event?.sid).not.toBe(sid);
  });

  it('follows a subagent from spawn to done', () => {
    const [spawn, tool, done] = replay([
      payloads.subagentStart(),
      payloads.subagentTool('Read'),
      payloads.subagentStop(),
    ]);
    expect(spawn?.event).toEqual({
      v: 1,
      t: 1794096000,
      seq: 0,
      sid,
      aid,
      role: 'Explore',
      kind: 'spawn',
      project: 'Ledgerly',
    });
    expect(tool?.event).toMatchObject({
      seq: 1,
      aid,
      role: 'Explore',
      kind: 'tool',
      cat: 'reading',
    });
    expect(tool?.event).not.toHaveProperty('goal');
    expect(done?.event).toMatchObject({ seq: 2, aid, kind: 'done' });
    expect(done?.remove).toBe('agent');
  });

  it('shows unlisted subagent types as Helper', () => {
    expect(run(payloads.subagentStart('acme-auditor')).event?.role).toBe('Helper');
  });

  it('ignores internal agents that stop without starting', () => {
    expect(run(payloads.subagentStop()).event).toBeUndefined();
  });

  it('removes all session state on end (H9)', () => {
    expect(run(payloads.sessionEnd('clear')).remove).toBe('session');
  });

  it('records tasks without sending, then sends the new goal', () => {
    const [created, update, read] = replay([
      payloads.taskCreated('1', 'Write the onboarding guide'),
      payloads.taskUpdate('1', 'in_progress'),
      payloads.tool('Read'),
    ]);
    expect(created?.event).toBeUndefined();
    expect(created?.session?.goal.tasks).toEqual([
      { id: '1', subject: 'Write the onboarding guide' },
    ]);
    expect(update?.event).toMatchObject({ cat: 'planning', goal: 'Write the onboarding guide' });
    expect(read?.event).toMatchObject({ cat: 'reading', goal: 'Write the onboarding guide' });
  });

  it('does nothing for unknown hooks, missing ids or a subagent Stop', () => {
    expect(run({ hook_event_name: 'Notification', session_id: SESSION_ID }).event).toBeUndefined();
    expect(run({ hook_event_name: 'Stop' })).toEqual({});
    expect(run({ ...payloads.stop(), agent_id: AGENT_ID }).event).toBeUndefined();
    expect(run({ ...payloads.tool('Read'), tool_name: 42 }).event).toBeUndefined();
    expect(run({ hook_event_name: 'SubagentStart', session_id: SESSION_ID }).event).toBeUndefined();
  });

  it('leaves state untouched when nothing changed', () => {
    const [first] = replay([payloads.tool('Edit')]);
    const again = decide({
      payload: payloads.tool('Edit'),
      config,
      secret: SECRET,
      now: NOW + 1,
      paths: PATHS,
      ...(first?.session ? { session: first.session } : {}),
    });
    expect(again).toEqual({});
  });
});

describe('privacy (threat model: a new payload field leaks private data)', () => {
  const hooks = [
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'Stop',
    'SubagentStart',
    'SubagentStop',
    'SessionEnd',
    'TaskCreated',
    'TaskCompleted',
    'Other',
  ];
  const privateText = fc
    .constantFrom(...PRIVATE_STRINGS)
    .chain((secret) => fc.string().map((s) => `${s}${secret}${s}`));
  const payloadArb = fc.record({
    hook_event_name: fc.constantFrom(...hooks),
    session_id: privateText,
    agent_id: fc.option(privateText, { nil: undefined }),
    agent_type: fc.option(fc.oneof(privateText, fc.constantFrom('Explore', 'Plan')), {
      nil: undefined,
    }),
    cwd: fc.constantFrom('/Users/ada/code/ledgerly/x', PRIVATE_CWD, '/tmp'),
    tool_name: fc.oneof(fc.constantFrom('Read', 'Bash', 'TaskUpdate', 'mcp__acme__x'), privateText),
    tool_input: fc.dictionary(fc.string(), fc.oneof(privateText, fc.anything())),
    // Titles and task subjects are the owner's opt-in free text for public projects,
    // so they are drawn from safe text here and checked separately below.
    session_title: fc.option(fc.constant('Building the paywall screen'), { nil: undefined }),
    task_subject: fc.option(fc.constant('Write the guide'), { nil: undefined }),
    extra: fc.anything(),
    [PRIVATE_STRINGS[0] ?? 'x']: fc.anything(),
  });

  it('never sends a field or value outside the schema, nor any private payload text', () => {
    fc.assert(
      fc.property(payloadArb, (payload) => {
        const { event } = run(payload);
        if (event === undefined) return;
        expect(IngestEventSchema.safeParse(event).success).toBe(true);
        for (const key of Object.keys(event)) expect(INGEST_EVENT_FIELDS).toContain(key);
        const text = JSON.stringify(event);
        for (const secret of PRIVATE_STRINGS) expect(text).not.toContain(secret);
        if (payload.cwd !== '/Users/ada/code/ledgerly/x') {
          expect(event).not.toHaveProperty('project');
          expect(event).not.toHaveProperty('goal');
        }
      }),
      { numRuns: 500 },
    );
  });

  it('never sends a title or task subject from a private folder', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (title, subject) => {
        const [start] = replay([{ ...payloads.sessionStart(PRIVATE_CWD), session_title: title }]);
        const [, , tool] = replay([
          payloads.taskCreated('1', subject, PRIVATE_CWD),
          payloads.taskUpdate('1', 'in_progress', PRIVATE_CWD),
          payloads.tool('Read', {}, PRIVATE_CWD),
        ]);
        expect(start?.event).not.toHaveProperty('goal');
        expect(tool?.event).not.toHaveProperty('goal');
      }),
    );
  });
});
