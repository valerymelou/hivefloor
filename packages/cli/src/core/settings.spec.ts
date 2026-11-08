import { describe, expect, it } from 'vitest';
import {
  addHooks,
  HOOK_EVENTS,
  isHivefloorCommand,
  registeredHooks,
  removeHooks,
} from './settings.js';

const CMD = '/usr/local/bin/node /usr/local/lib/node_modules/hivefloor/bin.mjs hook';
const others = {
  model: 'opus',
  permissions: { allow: ['Bash(pnpm test)'] },
  hooks: {
    PreToolUse: [
      { matcher: 'Bash', hooks: [{ type: 'command', command: './lint.sh', timeout: 30 }] },
    ],
    Notification: [{ hooks: [{ type: 'command', command: 'say done' }] }],
  },
};

describe('isHivefloorCommand', () => {
  it.each([
    'hivefloor hook',
    '"/opt/My Tools/hivefloor-darwin-arm64" hook',
    "'C:\\Program Files\\hivefloor\\hivefloor.exe' hook --record",
    'npx --yes hivefloor@0.1.0 hook',
    '/usr/bin/node /lib/node_modules/hivefloor/bin.mjs hook',
    '/usr/local/bin/node hook',
    '"C:\\Program Files\\nodejs\\node.exe" hook',
  ])('recognises %j', (command) => {
    expect(isHivefloorCommand(command)).toBe(true);
  });

  it.each([
    './lint.sh',
    'hivefloor doctor',
    'echo hook',
    'hook hivefloor',
    'node hook',
    '/usr/bin/nodemon hook',
    '/usr/bin/node hook.js',
  ])('ignores %j', (command) => {
    expect(isHivefloorCommand(command)).toBe(false);
  });
});

describe('addHooks (C1)', () => {
  it('replaces the broken commands 0.1.0 wrote, however many piled up', () => {
    const broken = { type: 'command', command: '/usr/local/bin/node hook', async: true };
    const before = {
      ...others,
      hooks: { ...others.hooks, Stop: [{ hooks: [broken] }, { hooks: [broken] }] },
    };
    const { settings } = addHooks(before, CMD);
    const stop = registeredHooks(settings).filter((hook) => hook.event === 'Stop');
    expect(stop).toEqual([expect.objectContaining({ command: CMD })]);
    expect(JSON.stringify(settings)).not.toContain(broken.command);
  });

  it('adds an async hook to every event and keeps everything else', () => {
    const { settings, events } = addHooks(others, CMD);
    expect(events).toEqual([...HOOK_EVENTS]);
    expect(settings).toMatchObject({ model: 'opus', permissions: others.permissions });
    expect(registeredHooks(settings)).toHaveLength(HOOK_EVENTS.length);
    expect(registeredHooks(settings).every((hook) => hook.async && hook.command === CMD)).toBe(
      true,
    );
    const pre = (settings['hooks'] as Record<string, unknown[]>)['PreToolUse'];
    expect(pre?.[0]).toEqual(others.hooks.PreToolUse[0]);
    expect((settings['hooks'] as Record<string, unknown>)['Notification']).toEqual(
      others.hooks.Notification,
    );
  });

  it('changes nothing the second time', () => {
    const first = addHooks(others, CMD);
    const second = addHooks(first.settings, CMD);
    expect(second.events).toEqual([]);
    expect(second.settings).toBe(first.settings);
  });

  it('updates the command without duplicating, keeping other handlers in the same group', () => {
    const shared = {
      hooks: {
        Stop: [
          {
            hooks: [
              { type: 'command', command: 'say bye' },
              { type: 'command', command: 'hivefloor hook' },
            ],
          },
        ],
      },
    };
    const { settings } = addHooks(shared, CMD);
    const stop = (settings['hooks'] as Record<string, unknown[]>)['Stop'];
    expect(stop).toEqual([
      { hooks: [{ type: 'command', command: 'say bye' }] },
      { hooks: [{ type: 'command', command: CMD, async: true }] },
    ]);
  });

  it('repairs a non-async or duplicated hook', () => {
    const broken = {
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: CMD }] },
          { hooks: [{ type: 'command', command: CMD, async: true }] },
        ],
      },
    };
    const { settings, events } = addHooks(broken, CMD);
    expect(events).toContain('Stop');
    expect(registeredHooks(settings).filter((h) => h.event === 'Stop')).toEqual([
      { event: 'Stop', command: CMD, async: true },
    ]);
  });

  it('tolerates odd shapes', () => {
    expect(
      addHooks({ hooks: { Stop: 'nope', PreToolUse: [null, { hooks: 'x' }] } }, CMD).events,
    ).toHaveLength(HOOK_EVENTS.length);
    expect(registeredHooks({ hooks: 'nope' })).toEqual([]);
  });
});

describe('removeHooks (C13)', () => {
  it('removes only Hivefloor hooks and empties it leaves behind', () => {
    const installed = addHooks(others, CMD).settings;
    const { settings, events } = removeHooks(installed);
    expect([...events].sort()).toEqual([...HOOK_EVENTS].sort());
    expect(settings).toEqual(others);
    expect(Object.keys(settings)).toEqual(Object.keys(others));
  });

  it('drops the hooks key when nothing is left', () => {
    const { settings } = removeHooks(addHooks({ model: 'x' }, CMD).settings);
    expect(settings).toEqual({ model: 'x' });
  });

  it('changes nothing without Hivefloor hooks', () => {
    expect(removeHooks(others)).toEqual({ settings: others, events: [] });
    expect(removeHooks({})).toEqual({ settings: {}, events: [] });
  });

  it('also removes a Hivefloor hook from an event it no longer uses', () => {
    const legacy = {
      hooks: { PostToolUse: [{ hooks: [{ type: 'command', command: 'hivefloor hook' }] }] },
    };
    expect(removeHooks(legacy).settings).toEqual({});
  });
});
