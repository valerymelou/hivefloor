import fc from 'fast-check';
import { CATEGORIES } from '@hivefloor/schema';
import { describe, expect, it } from 'vitest';
import { categorize, mcpServer, shellCategory } from './categories.js';

describe('shellCategory', () => {
  it.each([
    ['pnpm nx affected -t lint test', 'testing'],
    ['npx vitest run src/a.spec.ts', 'testing'],
    ['CI=true ./node_modules/.bin/jest --watch=false', 'testing'],
    ['cd app && npm run test:unit', 'testing'],
    ['python -m pytest -q', 'testing'],
    ['cargo nextest run', 'testing'],
    ['git status && git diff', 'vcs'],
    ['/usr/bin/git log --oneline', 'vcs'],
    ['gh pr create --title "add tests"', 'vcs'],
    ['git commit -m "add tests for x"', 'vcs'],
    ['git stash; pnpm test', 'testing'],
    ['ls -la', 'terminal'],
    ['', 'terminal'],
    ['   ;  && ', 'terminal'],
    ['git.exe status', 'vcs'],
  ])('%j → %s', (command, category) => {
    expect(shellCategory(command)).toBe(category);
  });

  it('runs in linear time on long input', () => {
    const started = performance.now();
    shellCategory(`${'a '.repeat(100_000)}&&${';'.repeat(100_000)}`);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('mcpServer', () => {
  it('extracts the server', () => {
    expect(mcpServer('mcp__figma__get_file')).toBe('figma');
    expect(mcpServer('mcp__memory')).toBe('memory');
    expect(mcpServer('mcp____x')).toBeUndefined();
    expect(mcpServer('Read')).toBeUndefined();
  });
});

describe('categorize (C5)', () => {
  const mcp = { figma: 'designing' } as const;

  it.each([
    ['Read', 'reading'],
    ['Grep', 'reading'],
    ['Edit', 'coding'],
    ['Write', 'coding'],
    ['WebSearch', 'research'],
    ['Agent', 'delegating'],
    ['TaskUpdate', 'planning'],
    ['TodoWrite', 'planning'],
    ['Monitor', 'monitoring'],
    ['EnterWorktree', 'vcs'],
    ['Skill', 'working'],
    ['constructor', 'working'],
    ['mcp__figma__get_file', 'designing'],
    ['mcp__sentry__issues', 'integration'],
    ['mcp__toString__x', 'integration'],
  ])('%s → %s', (tool, category) => {
    expect(categorize(tool, {}, mcp)).toBe(category);
  });

  it('classifies shell tools by command', () => {
    expect(categorize('Bash', { command: 'git push' }, mcp)).toBe('vcs');
    expect(categorize('PowerShell', { command: 'npm test' }, mcp)).toBe('testing');
    expect(categorize('Bash', undefined, mcp)).toBe('terminal');
  });

  it('always returns one of the 12 categories', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (tool, command) => {
        expect(CATEGORIES).toContain(categorize(tool, { command }, mcp));
      }),
    );
  });
});
