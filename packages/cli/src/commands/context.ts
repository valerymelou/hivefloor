import type { HomeEnv } from '../edge/home.js';

/** The process facilities commands use, injected so tests run without a terminal. */
export interface CommandIo {
  readonly env: HomeEnv & {
    readonly HIVEFLOOR_DEBUG?: string | undefined;
    readonly CLAUDE_CONFIG_DIR?: string | undefined;
  };
  readonly home: string;
  readonly cwd: string;
  readonly windows: boolean;
  /** `process.execPath` and `process.argv[1]`, to register the hook command. */
  readonly execPath: string;
  readonly script: string | undefined;
  /** Unix milliseconds. */
  readonly now: () => number;
  readonly readStdin: () => Promise<string>;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  /** `true` when a person can answer questions. */
  readonly interactive: boolean;
  readonly ask: (question: string) => Promise<string>;
  readonly randomSecret: () => string;
  readonly fetch: typeof fetch;
  /** Runs a program with inherited stdio and resolves with its exit code. */
  readonly runProcess: (file: string, args: readonly string[], input?: string) => Promise<number>;
  readonly launchSender: (body: string) => void;
}

/** Prints lines to stdout. */
export function say(io: CommandIo, ...lines: string[]): void {
  io.stdout(`${lines.join('\n')}\n`);
}
