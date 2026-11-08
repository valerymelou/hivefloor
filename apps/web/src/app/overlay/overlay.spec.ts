import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { msg, SNAPSHOT } from '../../test/fixtures';
import { axeViolations } from '../../test/axe';
import { DEMO_MODE } from '../app.config';
import { OfficeStore } from '../core/office-store';
import { ActivityFeed } from './activity-feed';
import { LiveBadge } from './live-badge';
import { OfficeHeader } from './office-header';
import { PrivacyNote } from './privacy-note';
import { PublicWork } from './public-work';
import { RobotList } from './robot-list';
import { TodayCounts } from './today-counts';

async function render<T>(component: Type<T>, fill = true) {
  TestBed.configureTestingModule({ providers: [{ provide: DEMO_MODE, useValue: true }] });
  const store = TestBed.inject(OfficeStore);
  if (fill) {
    store.apply(msg(SNAPSHOT), 100);
    store.apply(
      msg({
        type: 'delta',
        v: 1,
        robot: {
          key: 'b00000',
          role: 'claude',
          room: 'private',
          desk: 0,
          status: 'working',
          cat: 'testing',
          since: 101,
        },
      }),
      101,
    );
    store.apply(
      msg({
        type: 'delta',
        v: 1,
        robot: {
          key: 'a9f3c2:4be1d0',
          parent: 'a9f3c2',
          role: 'Explore',
          room: 'ledgerly',
          seat: 0,
          status: 'thinking',
          since: 102,
        },
      }),
      102,
    );
    store.apply(
      msg({
        type: 'delta',
        v: 1,
        robot: {
          key: 'b00000',
          role: 'claude',
          room: 'private',
          desk: 0,
          status: 'idle',
          since: 103,
        },
      }),
      103,
    );
  }
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return { fixture, store, element: fixture.nativeElement as HTMLElement };
}

describe('overlay components', () => {
  const all = [
    OfficeHeader,
    ActivityFeed,
    PublicWork,
    TodayCounts,
    PrivacyNote,
    RobotList,
  ] as const;

  it.each(all.map((c) => [c.name, c] as const))(
    '%s has no axe violations, filled and empty',
    async (_name, component) => {
      for (const fill of [true, false]) {
        const { element } = await render(component as Type<unknown>, fill);
        expect(await axeViolations(element)).toEqual([]);
        TestBed.resetTestingModule();
      }
    },
  );

  it('header shows the office, counts and connection state', async () => {
    const { element, store, fixture } = await render(OfficeHeader);
    expect(element.textContent).toContain('Hivefloor');
    expect(element.textContent).toContain('Valery Melou');
    expect(element.textContent).toContain('2 agents working');
    expect(element.textContent).toContain('3 agents in the office');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Connecting');
    store.connection.set('closed');
    store.closedUntil.set('01:00');
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      'Office closed until 01:00',
    );
    store.connection.set('live');
    await fixture.whenStable();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Live');
  });

  it('feed lists changes newest first, collapsing on phones (W12)', async () => {
    const { element, fixture } = await render(ActivityFeed);
    const items = [...element.querySelectorAll('li')];
    expect(items.map((li) => li.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Claude · Private project is on a coffee break',
      'Explore · Ledgerly arrived',
      'Claude · Private project arrived',
    ]);
    expect(items[2]?.classList.contains('hidden')).toBe(true);
    const button = element.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    button?.click();
    await fixture.whenStable();
    expect(element.querySelector('li.hidden')).toBeNull();
    expect(button?.textContent).toContain('Show less');
  });

  it('renders goals and names as text, never HTML (W4)', async () => {
    const { element, store, fixture } = await render(PublicWork);
    store.apply(
      msg({
        type: 'delta',
        v: 1,
        robot: {
          key: 'c00000',
          role: 'claude',
          room: 'ledgerly',
          desk: 1,
          goal: '<img src=x onerror=alert(1)>',
          status: 'working',
          cat: 'coding',
          since: 104,
        },
      }),
      104,
    );
    await fixture.whenStable();
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(element.textContent).toContain('Claude · Ledgerly');
  });

  it('today counts show room names, hiding private ones', async () => {
    const { element, store, fixture } = await render(TodayCounts);
    store.apply(msg({ type: 'today', v: 1, count: { room: 'private', cat: 'vcs', n: 7 } }), 105);
    await fixture.whenStable();
    const names = () =>
      [...element.querySelectorAll('li')].map(
        (row) =>
          `${row.querySelector('.uppercase')?.textContent ?? ''}: ${row.querySelector('.tabular-nums')?.textContent ?? ''}`,
      );
    expect(names()).toEqual(['Private project: 7', 'Ledgerly: 3']);
    store.apply(msg({ type: 'roomClosed', v: 1, id: 'ledgerly' }), 106);
    store.apply(msg({ type: 'today', v: 1, count: { room: 'ndop-ui', cat: 'vcs', n: 1 } }), 107);
    await fixture.whenStable();
    expect(names()).toEqual(['Private project: 7', 'Ledgerly: 3', 'Ndop UI: 1']);
  });

  it('lists everyone with role, room, activity, goal and time (W11)', async () => {
    const { element } = await render(RobotList);
    const rows = [...element.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.children].map((c) => c.textContent.trim()),
    );
    expect(rows[0]?.slice(0, 4)).toEqual([
      'Claude',
      'Ledgerly',
      'coding',
      'Building the paywall screen',
    ]);
    expect(rows.map((r) => r[0])).toEqual(['Claude', 'Claude', 'Explore']);
    expect(element.querySelector('caption')?.textContent).toContain('Every agent');
  });

  it('live badge counts working agents and links to the full office', async () => {
    const { element, store, fixture } = await render(LiveBadge);
    const link = element.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_top');
    expect(link?.textContent).toContain('Connecting');
    store.connection.set('live');
    await fixture.whenStable();
    expect(link?.textContent).toContain('agents working');
    expect(link?.getAttribute('aria-label')).toContain('Open the full office');
    store.closedUntil.set('01:00');
    store.connection.set('closed');
    await fixture.whenStable();
    expect(link?.textContent).toContain('Office closed until 01:00');
  });

  it('privacy note states the promise', async () => {
    const { element } = await render(PrivacyNote, false);
    expect(element.textContent).toContain('never leave');
  });
});
