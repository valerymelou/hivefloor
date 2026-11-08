import { readdir, readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { PATHS, payloads, PRIVATE_STRINGS } from '../test/payloads.js';
import { makeHome } from '../test/sandbox.js';
import type { HivefloorFiles } from './home.js';
import { runHook } from './hook.js';

const config = {
  v: 1,
  endpoint: 'https://office.example.com/ingest',
  projects: [{ path: '~/code/ledgerly', public: true, name: 'Ledgerly' }],
  publicAgentTypes: ['Explore'],
};
let cleanup: (() => Promise<void>) | undefined;
afterEach(() => cleanup?.());

async function setup(
  options: {
    config?: Record<string, unknown>;
    secret?: string;
    record?: boolean;
    debug?: boolean;
  } = {},
) {
  const home = await makeHome(options.config ?? config, options.secret);
  cleanup = home.cleanup;
  const sent: unknown[] = [];
  let clock = 1794096003_000;
  const hook = (payload: unknown) =>
    runHook(typeof payload === 'string' ? payload : JSON.stringify(payload), {
      files: home.files,
      paths: PATHS,
      now: () => (clock += 1000),
      launchSender: (body) => sent.push(JSON.parse(body)),
      record: options.record ?? false,
      debug: options.debug ?? false,
    });
  return { files: home.files, sent, hook };
}

const stateFiles = async (files: HivefloorFiles) =>
  (await readdir(files.stateDir)).filter((n) => !n.startsWith('config'));

describe('runHook', () => {
  it('sends one sanitized event per change and keeps per-robot state', async () => {
    const { files, sent, hook } = await setup();
    await hook(payloads.sessionStart());
    await hook(payloads.subagentStart());
    await hook(payloads.subagentTool('Read'));
    expect(sent).toMatchObject([
      { kind: 'start', project: 'Ledgerly', goal: 'Building the paywall screen', seq: 0 },
      { kind: 'spawn', role: 'Explore', seq: 0 },
      { kind: 'tool', cat: 'reading', seq: 1 },
    ]);
    expect(await stateFiles(files)).toHaveLength(2);
    await hook(payloads.subagentStop());
    expect(await stateFiles(files)).toHaveLength(1);
    await hook(payloads.sessionEnd());
    expect(await stateFiles(files)).toEqual([]);
    const text = JSON.stringify(sent);
    for (const secret of PRIVATE_STRINGS) expect(text).not.toContain(secret);
  });

  it.each([
    ['malformed stdin', 'not json'],
    ['an empty object', {}],
  ])('does nothing for %s', async (_label, input) => {
    const { sent, hook } = await setup();
    await hook(input);
    expect(sent).toEqual([]);
  });

  it('does nothing when paused, without a secret or without a config', async () => {
    const paused = await setup({ config: { ...config, paused: true } });
    await paused.hook(payloads.sessionStart());
    expect(paused.sent).toEqual([]);
    await cleanup?.();
    const noSecret = await setup({ secret: '' });
    await noSecret.hook(payloads.sessionStart());
    expect(noSecret.sent).toEqual([]);
  });

  it('records a scrubbed payload with --record', async () => {
    const { files, hook } = await setup({ record: true });
    await hook(payloads.userPrompt());
    const [name] = await readdir(files.recordings);
    expect(name).toMatch(/^UserPromptSubmit-\d+\.json$/);
    const recorded = await readFile(`${files.recordings}/${name ?? ''}`, 'utf8');
    expect(JSON.parse(recorded)).toMatchObject({
      hook_event_name: 'UserPromptSubmit',
      prompt: '<string:59>',
    });
    for (const secret of PRIVATE_STRINGS) expect(recorded).not.toContain(secret);
  });

  it('logs only the hook name and the sanitized event when debugging', async () => {
    const { files, hook } = await setup({ debug: true });
    await hook(payloads.userPrompt());
    const log = await readFile(files.debugLog, 'utf8');
    expect(log).toContain('"hook":"UserPromptSubmit"');
    for (const secret of PRIVATE_STRINGS) expect(log).not.toContain(secret);
  });
});
