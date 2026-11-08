import { describe, expect, it } from 'vitest';
import { testConfig } from '../test/payloads.js';
import { normalizePath, resolveProject } from './project.js';

const mac = { home: '/Users/ada', windows: false };
const win = { home: 'C:\\Users\\Ada', windows: true };

describe('normalizePath', () => {
  it.each([
    ['~/code/ledgerly/', mac, '/Users/ada/code/ledgerly'],
    ['~', mac, '/Users/ada'],
    ['/a//b///c', mac, '/a/b/c'],
    ['/', mac, '/'],
    ['~\\code\\App', win, 'c:/users/ada/code/app'],
    ['C:\\Code\\App\\', win, 'c:/code/app'],
  ])('%s → %s', (path, context, expected) => {
    expect(normalizePath(path, context)).toBe(expected);
  });
});

describe('resolveProject (C4)', () => {
  const projects = testConfig({
    projects: [
      { path: '~/code', public: false },
      { path: '~/code/ledgerly', public: true, name: 'Ledgerly' },
      { path: '~/code/ledgerly/vendor', public: false },
    ],
  }).projects;

  it('picks the longest matching prefix', () => {
    expect(resolveProject('/Users/ada/code/ledgerly/apps', projects, mac)).toEqual({
      isPublic: true,
      name: 'Ledgerly',
    });
    expect(resolveProject('/Users/ada/code/ledgerly/vendor/x', projects, mac)).toEqual({
      isPublic: false,
    });
    expect(resolveProject('/Users/ada/code/other', projects, mac)).toEqual({ isPublic: false });
  });

  it('matches whole folders only', () => {
    expect(resolveProject('/Users/ada/code/ledgerly-old', projects, mac)).toEqual({
      isPublic: false,
    });
  });

  it('treats unmatched folders as private', () => {
    expect(resolveProject('/tmp', projects, mac)).toEqual({ isPublic: false });
  });

  it('handles Windows paths case-insensitively', () => {
    const winProjects = testConfig({
      projects: [{ path: 'C:\\Code\\Ledgerly', public: true, name: 'Ledgerly' }],
    }).projects;
    expect(resolveProject('c:\\code\\ledgerly\\src', winProjects, win)).toEqual({
      isPublic: true,
      name: 'Ledgerly',
    });
  });

  it('lets a root path match everything', () => {
    const all = testConfig({
      projects: [{ path: '/', public: true, name: 'Everything' }],
    }).projects;
    expect(resolveProject('/any/where', all, mac)).toEqual({ isPublic: true, name: 'Everything' });
  });
});
