/**
 * Hook payloads shaped like the examples in the Claude Code hooks reference
 * (https://code.claude.com/docs/en/hooks), with private-looking values on
 * purpose, so tests can prove none of them leave the machine. Replace with
 * payloads recorded by `hivefloor hook --record` when available.
 */
import { MachineConfigSchema, type MachineConfig } from '@hivefloor/schema';

export const SESSION_ID = '00893aaf-19fa-41d2-8238-13269b9b3ca0';
export const AGENT_ID = 'agent-def456';
export const PUBLIC_CWD = '/Users/ada/code/ledgerly/apps/mobile';
export const PRIVATE_CWD = '/Users/ada/clients/acme-bank';
export const SECRET = 'test-secret-0123456789abcdef';

const common = (cwd: string): Record<string, unknown> => ({
  session_id: SESSION_ID,
  prompt_id: '550e8400-e29b-41d4-a716-446655440000',
  transcript_path: '/Users/ada/.claude/projects/acme-bank/00893aaf.jsonl',
  cwd,
  scratchpad_dir: '/private/tmp/claude/acme-bank',
  permission_mode: 'default',
  effort: { level: 'high' },
});

export const payloads = {
  sessionStart: (cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'SessionStart',
    source: 'startup',
    model: 'claude-opus-5-5',
    session_title: 'Building the paywall screen',
  }),
  userPrompt: (cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'UserPromptSubmit',
    prompt: 'Add the ACME_BANK_API_KEY=sk-live-123 to the payment client',
  }),
  bash: (command: string, cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'Run it' },
    tool_use_id: 'toolu_01ABC123',
  }),
  tool: (toolName: string, toolInput: Record<string, unknown> = {}, cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: 'toolu_01DEF456',
  }),
  subagentTool: (toolName: string, cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: { file_path: '/Users/ada/clients/acme-bank/secrets.env' },
    agent_id: AGENT_ID,
    agent_type: 'Explore',
  }),
  subagentStart: (agentType = 'Explore', cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'SubagentStart',
    agent_id: AGENT_ID,
    agent_type: agentType,
  }),
  subagentStop: (cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'SubagentStop',
    stop_hook_active: false,
    agent_id: AGENT_ID,
    agent_type: 'Explore',
    agent_transcript_path: '/Users/ada/.claude/projects/acme/subagents/agent-def456.jsonl',
    last_assistant_message: 'Found the ACME credentials in secrets.env',
    background_tasks: [],
    session_crons: [],
  }),
  stop: (cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'Stop',
    stop_hook_active: false,
    last_assistant_message: 'Done. The ACME client now reads the key.',
    background_tasks: [
      { id: 't1', type: 'shell', status: 'running', command: 'tail -f /var/log/acme' },
    ],
    session_crons: [],
  }),
  sessionEnd: (reason = 'other', cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'SessionEnd',
    reason,
  }),
  taskCreated: (id: string, subject: string, cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'TaskCreated',
    task_id: id,
    task_subject: subject,
    task_description: 'Private details about the ACME integration',
  }),
  taskUpdate: (id: string, status: string, cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'PreToolUse',
    tool_name: 'TaskUpdate',
    tool_input: { taskId: id, status },
  }),
  taskCompleted: (id: string, cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'TaskCompleted',
    task_id: id,
    task_subject: 'whatever',
  }),
  todoWrite: (todos: readonly Record<string, unknown>[], cwd = PUBLIC_CWD) => ({
    ...common(cwd),
    hook_event_name: 'PreToolUse',
    tool_name: 'TodoWrite',
    tool_input: { todos },
  }),
};

/** A machine config with Ledgerly public, everything else private. */
export function testConfig(overrides: Record<string, unknown> = {}): MachineConfig {
  return MachineConfigSchema.parse({
    v: 1,
    endpoint: 'https://office.example.com/ingest',
    projects: [
      { path: '~/code/ledgerly', public: true, name: 'Ledgerly' },
      { path: '~/clients', public: false },
    ],
    publicAgentTypes: ['Explore', 'Plan'],
    mcpCategories: { figma: 'designing' },
    ...overrides,
  });
}

export const PATHS = { home: '/Users/ada', windows: false } as const;

/** Every string in the fixtures that must never appear in an event. */
export const PRIVATE_STRINGS = [
  SESSION_ID,
  AGENT_ID,
  'acme',
  'ACME',
  'sk-live',
  '/Users/ada',
  'secrets.env',
  'toolu_',
  'claude-opus',
];
