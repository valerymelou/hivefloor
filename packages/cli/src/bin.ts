#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { selfCommand } from './edge/sender.js';
import { main } from './main.js';

/** The hook gives up after this long, whatever it is doing. */
const HOOK_DEADLINE_MS = 2500;
/** Stdin larger than this is not read further. */
const MAX_STDIN = 8 * 1024 * 1024;

const args = process.argv.slice(2);

if (args[0] === 'hook' || args[0] === '__send') {
  // Exit 0 no matter what: never break or block Claude Code.
  const quit = (): never => process.exit(0);
  process.on('uncaughtException', quit);
  process.on('unhandledRejection', quit);
  setTimeout(quit, HOOK_DEADLINE_MS).unref();
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_STDIN) return '';
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

function launchSender(body: string): void {
  try {
    const self = selfCommand(process.execPath, process.argv);
    spawn(self.file, [...self.args, '__send', body], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  } catch {
    // Silent, like every other sending failure.
  }
}

function runProcess(file: string, argv: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(file, [...argv], { stdio: 'inherit' });
    child.on('error', () => {
      resolve(1);
    });
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
}

process.exitCode = await main(args, {
  env: process.env,
  home: homedir(),
  cwd: process.cwd(),
  windows: process.platform === 'win32',
  execPath: process.execPath,
  script: process.argv[1],
  now: () => Date.now(),
  readStdin,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  interactive: process.stdin.isTTY && process.stdout.isTTY,
  ask,
  randomSecret: () => randomBytes(32).toString('base64url'),
  fetch,
  runProcess,
  launchSender,
});
