import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hivefloorFiles, officeCacheFile, stateFile } from './home.js';

describe('hivefloorFiles', () => {
  it('uses HIVEFLOOR_HOME first', () => {
    expect(hivefloorFiles({ HIVEFLOOR_HOME: '/x' }, '/home/ada', false).config).toBe(
      join('/x', 'config.json'),
    );
  });

  it('follows XDG on macOS and Linux', () => {
    expect(hivefloorFiles({}, '/home/ada', false).dir).toBe('/home/ada/.config/hivefloor');
    expect(hivefloorFiles({ XDG_CONFIG_HOME: '/cfg' }, '/home/ada', false).secret).toBe(
      join('/cfg/hivefloor', 'secret'),
    );
  });

  it('uses APPDATA on Windows', () => {
    expect(
      hivefloorFiles({ APPDATA: 'C:\\Users\\Ada\\AppData\\Roaming' }, 'C:\\Users\\Ada', true).dir,
    ).toBe('C:\\Users\\Ada\\AppData\\Roaming\\hivefloor');
    expect(hivefloorFiles({}, 'C:\\Users\\Ada', true).dir).toBe(
      'C:\\Users\\Ada\\AppData\\Roaming\\hivefloor',
    );
  });

  it('names state and cache files', () => {
    const files = hivefloorFiles({ HIVEFLOOR_HOME: '/h' }, '/home/ada', false);
    expect(stateFile('/s', 'aaaa')).toBe(join('/s', 'aaaa.json'));
    expect(stateFile('/s', 'aaaa', 'bbbb')).toBe(join('/s', 'aaaa.bbbb.json'));
    expect(officeCacheFile(files)).toBe(join('/h', 'state', 'office.cache.json'));
  });
});
