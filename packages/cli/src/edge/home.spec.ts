import { describe, expect, it } from 'vitest';
import { hivefloorFiles, stateFile } from './home.js';

describe('hivefloorFiles', () => {
  it('uses HIVEFLOOR_HOME first', () => {
    expect(hivefloorFiles({ HIVEFLOOR_HOME: '/x' }, '/home/ada', false).config).toBe(
      '/x/config.json',
    );
  });

  it('follows XDG on macOS and Linux', () => {
    expect(hivefloorFiles({}, '/home/ada', false).dir).toBe('/home/ada/.config/hivefloor');
    expect(hivefloorFiles({ XDG_CONFIG_HOME: '/cfg' }, '/home/ada', false).secret).toBe(
      '/cfg/hivefloor/secret',
    );
  });

  it('uses APPDATA on Windows', () => {
    expect(
      hivefloorFiles({ APPDATA: 'C:\\Users\\Ada\\AppData\\Roaming' }, 'C:\\Users\\Ada', true).dir,
    ).toBe('C:\\Users\\Ada\\AppData\\Roaming\\hivefloor');
    expect(hivefloorFiles({}, 'C:\\Users\\Ada', true).stateDir).toBe(
      'C:\\Users\\Ada\\AppData\\Roaming\\hivefloor\\state',
    );
  });

  it('names state files by session and agent', () => {
    expect(stateFile('/s', 'aaaa')).toBe('/s/aaaa.json');
    expect(stateFile('/s', 'aaaa', 'bbbb')).toBe('/s/aaaa.bbbb.json');
  });
});
