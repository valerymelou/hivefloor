import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe';
import { msg, robot, SNAPSHOT } from '../../test/fixtures';
import { DEMO_MODE } from '../app.config';
import { OfficeStore } from '../core/office-store';
import { RobotCard } from './robot-card';

const MAIN = robot();
const SUBAGENT = robot({
  key: 'a9f3c2:4be1d0',
  parent: 'a9f3c2',
  role: 'Explore',
  desk: undefined,
  seat: 0,
  cat: 'reading',
});

async function setup(shown = MAIN) {
  TestBed.configureTestingModule({ providers: [{ provide: DEMO_MODE, useValue: true }] });
  const store = TestBed.inject(OfficeStore);
  store.apply(msg(SNAPSHOT), 100);
  store.selected.set(shown.key);
  const fixture = TestBed.createComponent(RobotCard);
  fixture.componentRef.setInput('robot', shown);
  await fixture.whenStable();
  return { store, element: fixture.nativeElement as HTMLElement };
}

describe('RobotCard (W9)', () => {
  it('shows role, project, status and time in status, without axe violations', async () => {
    const { element } = await setup();
    expect(element.querySelector('h2')?.textContent).toBe('Claude · Ledgerly');
    expect(element.textContent).toContain('coding');
    expect(element.textContent).toContain('Project');
    expect(await axeViolations(element)).toEqual([]);
  });

  it('names a subagent by type', async () => {
    const { element } = await setup(SUBAGENT);
    expect(element.textContent).toContain('Explore · subagent');
  });

  it('closes with its button', async () => {
    const { store, element } = await setup();
    element.querySelector('button')?.click();
    expect(store.selected()).toBeUndefined();
  });

  it('closes with Escape', async () => {
    const { store } = await setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(store.selected()).toBeUndefined();
  });

  it('has nothing to show once the robot leaves', async () => {
    const { store } = await setup();
    expect(store.selectedRobot()?.key).toBe(MAIN.key);
    store.apply(msg({ type: 'leave', v: 1, key: MAIN.key }), 110);
    expect(store.selectedRobot()).toBeUndefined();
  });
});
