import { describe, expect, it } from 'vitest';
import { endpointFromOfficeUrl, hookCommand, quoteArg, relayBase } from './commands.js';
import { trimChars } from './text.js';

describe('hookCommand', () => {
  it('registers a compiled binary by its absolute path', () => {
    expect(
      hookCommand({
        execPath: '/usr/local/bin/hivefloor',
        script: '/$bunfs/root/hivefloor',
        version: '0.1.0',
        windows: false,
      }),
    ).toEqual({
      command: '/usr/local/bin/hivefloor hook',
    });
  });

  it('registers Node and the script for a global install, quoting paths with spaces', () => {
    expect(
      hookCommand({
        execPath: '/usr/bin/node',
        script: '/usr/lib/node_modules/hivefloor/bin.mjs',
        version: '0.1.0',
        windows: false,
      }),
    ).toEqual({
      command: '/usr/bin/node /usr/lib/node_modules/hivefloor/bin.mjs hook',
    });
    expect(
      hookCommand({
        execPath: 'C:\\Program Files\\nodejs\\node.exe',
        script: 'C:\\Users\\Ada\\AppData\\Roaming\\npm\\node_modules\\hivefloor\\bin.mjs',
        version: '0.1.0',
        windows: true,
      }).command,
    ).toBe(
      '"C:\\Program Files\\nodejs\\node.exe" C:\\Users\\Ada\\AppData\\Roaming\\npm\\node_modules\\hivefloor\\bin.mjs hook',
    );
  });

  it('falls back to npx with a warning when run through npx', () => {
    const result = hookCommand({
      execPath: '/usr/bin/node',
      script: '/Users/ada/.npm/_npx/abc/node_modules/hivefloor/bin.mjs',
      version: '0.1.0',
      windows: false,
    });
    expect(result.command).toBe('npx --yes hivefloor@0.1.0 hook');
    expect(result.warning).toContain('npm install -g hivefloor');
  });
});

describe('quoteArg', () => {
  it('quotes only when needed', () => {
    expect(quoteArg('/a/b', false)).toBe('/a/b');
    expect(quoteArg("/My Apps/it's", false)).toBe(`'/My Apps/it'\\''s'`);
    expect(quoteArg('C:\\A B\\"x"', true)).toBe('"C:\\A B\\""x"""');
  });
});

describe('office URLs', () => {
  it.each([
    ['https://office.example.com', 'https://office.example.com/ingest'],
    ['https://office.example.com/', 'https://office.example.com/ingest'],
    ['https://example.com/office///', 'https://example.com/office/ingest'],
    ['https://office.example.com/ingest', 'https://office.example.com/ingest'],
    ['  http://localhost:8787 ', 'http://localhost:8787/ingest'],
  ])('%j → %j', (url, endpoint) => {
    expect(endpointFromOfficeUrl(url)).toBe(endpoint);
  });

  it('rejects non-URLs and other schemes', () => {
    expect(endpointFromOfficeUrl('office')).toBeUndefined();
    expect(endpointFromOfficeUrl('ftp://x.example')).toBeUndefined();
  });

  it('finds the relay base', () => {
    expect(relayBase('https://example.com/office/ingest')).toBe('https://example.com/office');
  });
});

describe('trimChars', () => {
  it('trims both ends or only the end, in linear time', () => {
    expect(trimChars(`"'x'"`, `"'`)).toBe('x');
    expect(trimChars('//a//', '/', 'end')).toBe('//a');
    expect(trimChars('////', '/')).toBe('');
    const started = performance.now();
    trimChars(`${'"'.repeat(200_000)}a${'"'.repeat(200_000)}`, '"');
    expect(performance.now() - started).toBeLessThan(200);
  });
});
