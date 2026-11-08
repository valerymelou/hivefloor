import { describe, expect, it } from 'vitest';
import { upsertMachineProject, upsertOfficeProject } from './public-project.js';

const context = { home: '/home/ada', windows: false };

describe('upsertMachineProject', () => {
  it('adds a new folder as public', () => {
    const other = { path: '/code/other', public: false };
    expect(upsertMachineProject([other], '/code/app', 'App', context)).toEqual({
      projects: [other, { path: '/code/app', public: true, name: 'App' }],
      change: 'added',
    });
  });

  it('leaves the list alone when the folder is already public under that name', () => {
    const projects = [{ path: '/code/app', public: true, name: 'App' }];
    const result = upsertMachineProject(projects, '/code/app', 'App', context);
    expect(result).toEqual({ projects, change: 'unchanged' });
    expect(result.projects).toBe(projects);
  });

  it('matches a hand-written ~ path and keeps its spelling and position', () => {
    const projects = [
      { path: '~/code/app/', public: false },
      { path: '/code/other', public: false },
    ];
    expect(upsertMachineProject(projects, '/home/ada/code/app', 'App', context)).toEqual({
      projects: [
        { path: '~/code/app/', public: true, name: 'App' },
        { path: '/code/other', public: false },
      ],
      change: 'updated',
    });
  });

  it('reports the previous name when renaming', () => {
    const projects = [{ path: '/code/app', public: true, name: 'Old' }];
    expect(upsertMachineProject(projects, '/code/app', 'New', context)).toEqual({
      projects: [{ path: '/code/app', public: true, name: 'New' }],
      change: 'updated',
      previousName: 'Old',
    });
  });

  it('matches paths without regard to case on Windows', () => {
    const windows = { home: 'C:\\Users\\ada', windows: true };
    const projects = [{ path: 'C:\\Code\\App', public: true, name: 'App' }];
    expect(upsertMachineProject(projects, 'c:/code/app', 'App', windows).change).toBe('unchanged');
  });

  it('ignores entries that are not projects', () => {
    expect(upsertMachineProject([1, {}], '/code/app', 'App', context).projects).toEqual([
      1,
      {},
      { path: '/code/app', public: true, name: 'App' },
    ]);
  });
});

describe('upsertOfficeProject', () => {
  it('adds a new name, with its colour when given', () => {
    expect(upsertOfficeProject([], { name: 'App', color: '#112233' })).toEqual({
      kind: 'ok',
      projects: [{ name: 'App', color: '#112233' }],
      change: 'added',
    });
  });

  it('leaves the list alone when the name is there and no new colour is given', () => {
    const projects = [{ name: 'App', color: '#112233', group: 'web' }];
    const result = upsertOfficeProject(projects, { name: 'App' });
    expect(result).toEqual({ kind: 'ok', projects, change: 'unchanged' });
  });

  it('leaves the list alone when the colour is already that one', () => {
    const projects = [{ name: 'App', color: '#112233' }];
    expect(upsertOfficeProject(projects, { name: 'App', color: '#112233' })).toMatchObject({
      change: 'unchanged',
    });
  });

  it('updates only the colour of an existing entry', () => {
    const other = { name: 'Other' };
    expect(
      upsertOfficeProject([other, { name: 'App', group: 'web' }], {
        name: 'App',
        color: '#445566',
      }),
    ).toEqual({
      kind: 'ok',
      projects: [other, { name: 'App', group: 'web', color: '#445566' }],
      change: 'updated',
    });
  });

  it('reports a name that differs only by case, because the relay compares exactly', () => {
    expect(upsertOfficeProject([{ name: 'LEDGERLY' }], { name: 'Ledgerly' })).toEqual({
      kind: 'conflict',
      existing: 'LEDGERLY',
    });
  });

  it('ignores entries that are not projects', () => {
    expect(upsertOfficeProject([null], { name: 'App' })).toMatchObject({
      projects: [null, { name: 'App' }],
      change: 'added',
    });
  });
});
