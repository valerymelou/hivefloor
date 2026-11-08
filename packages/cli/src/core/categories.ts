import type { Category } from '@hivefloor/schema';
import { isRecord, readString, type Payload } from './payload.js';

const TOOL_CATEGORIES: ReadonlyMap<string, Category> = new Map<string, Category>([
  ['Read', 'reading'],
  ['Glob', 'reading'],
  ['Grep', 'reading'],
  ['LSP', 'reading'],
  ['ListMcpResourcesTool', 'reading'],
  ['ReadMcpResourceTool', 'reading'],
  ['Edit', 'coding'],
  ['MultiEdit', 'coding'],
  ['Write', 'coding'],
  ['NotebookEdit', 'coding'],
  ['WebFetch', 'research'],
  ['WebSearch', 'research'],
  ['Agent', 'delegating'],
  ['Task', 'delegating'],
  ['SendMessage', 'delegating'],
  ['ListAgents', 'delegating'],
  ['SubagentHandback', 'delegating'],
  ['Workflow', 'delegating'],
  ['TaskStop', 'delegating'],
  ['TaskCreate', 'planning'],
  ['TaskUpdate', 'planning'],
  ['TaskGet', 'planning'],
  ['TaskList', 'planning'],
  ['TodoWrite', 'planning'],
  ['EnterPlanMode', 'planning'],
  ['ExitPlanMode', 'planning'],
  ['AskUserQuestion', 'planning'],
  ['Monitor', 'monitoring'],
  ['CronCreate', 'monitoring'],
  ['CronDelete', 'monitoring'],
  ['CronList', 'monitoring'],
  ['ScheduleWakeup', 'monitoring'],
  ['EnterWorktree', 'vcs'],
  ['ExitWorktree', 'vcs'],
  ['RemoteTrigger', 'integration'],
]);

const SHELL_TOOLS: ReadonlySet<string> = new Set(['Bash', 'PowerShell']);

const TEST_RUNNERS: ReadonlySet<string> = new Set([
  'vitest',
  'jest',
  'pytest',
  'mocha',
  'playwright',
  'cypress',
  'rspec',
  'phpunit',
  'ava',
  'karma',
  'jasmine',
  'nextest',
]);

const TEST_WORDS: ReadonlySet<string> = new Set(['test', 'tests', 'e2e', 'test-ci']);

const VCS_COMMANDS: ReadonlySet<string> = new Set(['git', 'gh', 'glab', 'hg', 'svn', 'jj']);

const MCP_PREFIX = 'mcp__';

function commandName(token: string): string {
  const base = token.slice(Math.max(token.lastIndexOf('/'), token.lastIndexOf('\\')) + 1);
  return base.endsWith('.exe') ? base.slice(0, -4) : base;
}

function isTestToken(token: string): boolean {
  return TEST_RUNNERS.has(commandName(token)) || TEST_WORDS.has(token) || token.startsWith('test:');
}

/**
 * Classifies a shell command, read only on the owner's machine. A segment whose
 * first word is a version-control tool is `vcs`; any segment that runs tests is
 * `testing` (which wins); everything else is `terminal`.
 *
 * @param command - The command line from `tool_input.command`.
 * @returns `testing`, `vcs` or `terminal`.
 *
 * @example
 * ```ts
 * shellCategory('pnpm nx affected -t test'); // "testing"
 * shellCategory('git status && git diff'); // "vcs"
 * ```
 */
export function shellCategory(command: string): Category {
  let vcs = false;
  for (const segment of command.toLowerCase().split(/&&|\|\||[;|\n]/)) {
    const tokens = segment.split(/\s+/).filter((token) => token.length > 0 && !token.includes('='));
    const [first] = tokens;
    if (first === undefined) {
      continue;
    }
    if (VCS_COMMANDS.has(commandName(first))) {
      vcs = true;
    } else if (tokens.some(isTestToken)) {
      return 'testing';
    }
  }
  return vcs ? 'vcs' : 'terminal';
}

/**
 * Extracts the server name from an MCP tool name such as `mcp__figma__get_file`.
 *
 * @param toolName - The tool name.
 * @returns The server name, or `undefined` for non-MCP tools.
 */
export function mcpServer(toolName: string): string | undefined {
  if (!toolName.startsWith(MCP_PREFIX)) {
    return undefined;
  }
  const rest = toolName.slice(MCP_PREFIX.length);
  const end = rest.indexOf('__');
  const server = end === -1 ? rest : rest.slice(0, end);
  return server.length > 0 ? server : undefined;
}

/**
 * Maps a tool call to one of the 12 categories (C5). The tool input and MCP
 * server name are only read here, on the owner's machine; neither is sent.
 *
 * @param toolName - `tool_name` from the payload.
 * @param toolInput - `tool_input` from the payload, if any.
 * @param mcpCategories - The owner's MCP server to category map.
 * @returns The category.
 */
export function categorize(
  toolName: string,
  toolInput: Payload | undefined,
  mcpCategories: Readonly<Record<string, Category>>,
): Category {
  if (SHELL_TOOLS.has(toolName)) {
    return shellCategory(readString(toolInput, 'command') ?? '');
  }
  const server = mcpServer(toolName);
  if (server !== undefined) {
    const configured =
      isRecord(mcpCategories) && Object.hasOwn(mcpCategories, server)
        ? mcpCategories[server]
        : undefined;
    return configured ?? 'integration';
  }
  return TOOL_CATEGORIES.get(toolName) ?? 'working';
}
