import type { CommandIo } from '../commands/context.js';

/** A recording CommandIo for tests: answers questions from a list. */
export function testIo(options: {
  home: string;
  hivefloorHome: string;
  claudeDir: string;
  cwd?: string;
  stdin?: string;
  answers?: string[];
  interactive?: boolean;
  windows?: boolean;
  fetch?: typeof fetch;
  script?: string;
  exitCode?: number;
}) {
  const out: string[] = [];
  const err: string[] = [];
  const asked: string[] = [];
  const ran: { file: string; args: readonly string[] }[] = [];
  const sent: string[] = [];
  const answers = [...(options.answers ?? [])];
  let clock = 1794096003_000;
  const io: CommandIo = {
    env: { HIVEFLOOR_HOME: options.hivefloorHome, CLAUDE_CONFIG_DIR: options.claudeDir },
    home: options.home,
    cwd: options.cwd ?? `${options.home}/code/ledgerly`,
    windows: options.windows ?? false,
    execPath: '/usr/local/bin/node',
    script: options.script ?? '/usr/local/lib/node_modules/hivefloor/bin.mjs',
    now: () => (clock += 1000),
    readStdin: () => Promise.resolve(options.stdin ?? ''),
    stdout: (t) => out.push(t),
    stderr: (t) => err.push(t),
    interactive: options.interactive ?? false,
    ask: (q) => {
      asked.push(q);
      return Promise.resolve(answers.shift() ?? '');
    },
    randomSecret: () => 'generated-secret-0123456789abcdef',
    fetch: options.fetch ?? (() => Promise.reject(new Error('no network in tests'))),
    runProcess: (file, args) => {
      ran.push({ file, args });
      return Promise.resolve(options.exitCode ?? 0);
    },
    launchSender: (body) => sent.push(body),
  };
  return { io, out: () => out.join(''), err: () => err.join(''), asked, ran, sent };
}
