import { Component, computed, inject, input } from '@angular/core';
import type { Robot } from '@hivefloor/schema';
import { Clock } from '../core/clock';
import { activity, robotName, roomName } from '../core/office-view';
import { OfficeStore } from '../core/office-store';
import { STRINGS } from '../core/strings';
import { Button } from '../ui/button/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../ui/card/card';

/** The card for a clicked robot: role, project, status and time in status (W9). */
@Component({
  selector: 'hf-robot-card',
  imports: [Button, Card, CardAction, CardContent, CardHeader, CardTitle],
  template: `
    <section
      ndCard
      class="w-72 shadow-lg"
      aria-labelledby="robot-card-title"
      data-testid="robot-card"
    >
      <div ndCardHeader>
        <h2 ndCardTitle id="robot-card-title">{{ details().title }}</h2>
        <div ndCardAction>
          <button ndButton variant="ghost" size="sm" type="button" (click)="close()">
            {{ strings.close }}
          </button>
        </div>
      </div>
      <dl ndCardContent class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt class="text-muted-foreground">{{ strings.role }}</dt>
        <dd>{{ details().role }}</dd>
        <dt class="text-muted-foreground">{{ strings.project }}</dt>
        <dd>{{ details().project }}</dd>
        <dt class="text-muted-foreground">{{ strings.status }}</dt>
        <dd>{{ details().status }}</dd>
        <dt class="text-muted-foreground">{{ strings.since }}</dt>
        <dd>{{ details().since }}</dd>
      </dl>
    </section>
  `,
  host: { '(document:keydown.escape)': 'close()' },
})
export class RobotCard {
  private readonly store = inject(OfficeStore);
  private readonly clock = inject(Clock);
  protected readonly strings = STRINGS.card;

  /** The robot to describe. */
  readonly robot = input.required<Robot>();

  protected readonly details = computed(() => {
    const robot = this.robot();
    const name = robotName(robot);
    const project = roomName(robot, this.store.view().rooms);
    return {
      title: `${name} · ${project}`,
      role: robot.parent === undefined ? name : STRINGS.scene.subagent(robot.role),
      project,
      status: activity(robot),
      since: STRINGS.duration(Math.max(0, this.clock.now() - robot.since)),
    };
  });

  protected close(): void {
    this.store.selected.set(undefined);
  }
}
