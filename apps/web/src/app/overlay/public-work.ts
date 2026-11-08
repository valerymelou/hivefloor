import { Component, inject } from '@angular/core';
import type { Robot } from '@hivefloor/schema';
import { OfficeStore } from '../core/office-store';
import { robotName, roomColor, roomName } from '../core/office-view';
import { STRINGS } from '../core/strings';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card/card';

/** "Building in public": the goals of sessions in public projects (W5). */
@Component({
  selector: 'hf-public-work',
  imports: [Card, CardContent, CardHeader, CardTitle],
  template: `
    <section ndCard aria-labelledby="public-title">
      <div ndCardHeader>
        <h2 ndCardTitle id="public-title">{{ strings.title }}</h2>
      </div>
      <div ndCardContent class="flex flex-col gap-3">
        @if (store.publicWork().length === 0) {
          <p class="text-sm text-muted-foreground">{{ strings.empty }}</p>
        } @else {
          <ul class="hf-capped flex flex-col gap-2.5 text-sm">
            @for (robot of store.publicWork(); track robot.key) {
              <li class="flex items-baseline gap-2.5">
                <span class="hf-dot" [style.background]="color(robot)"></span>
                <span class="min-w-0">
                  <span class="font-medium">{{ name(robot) }} · {{ room(robot) }}</span>
                  <span class="block text-muted-foreground">{{ robot.goal }}</span>
                </span>
              </li>
            }
          </ul>
        }
        <ng-content />
      </div>
    </section>
  `,
})
export class PublicWork {
  protected readonly store = inject(OfficeStore);
  protected readonly strings = STRINGS.publicWork;
  protected readonly name = robotName;
  protected room(robot: Robot): string {
    return roomName(robot, this.store.view().rooms);
  }
  protected color(robot: Robot): string {
    return roomColor(robot, this.store.view().rooms);
  }
}
