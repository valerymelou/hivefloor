import { Component, inject } from '@angular/core';
import { OfficeStore } from '../core/office-store';
import { robotName, roomName } from '../core/office-view';
import { STRINGS } from '../core/strings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card/card';

/** "Building in public": the goals of sessions in public projects (W5). */
@Component({
  selector: 'hf-public-work',
  imports: [Card, CardContent, CardDescription, CardHeader, CardTitle],
  template: `
    <section ndCard aria-labelledby="public-title">
      <div ndCardHeader>
        <h2 ndCardTitle id="public-title">{{ strings.title }}</h2>
        <p ndCardDescription>{{ strings.description }}</p>
      </div>
      <div ndCardContent>
        @if (store.publicWork().length === 0) {
          <p class="text-sm text-muted-foreground">{{ strings.empty }}</p>
        } @else {
          <ul class="flex flex-col gap-2 text-sm">
            @for (robot of store.publicWork(); track robot.key) {
              <li>
                <span class="font-medium">{{ name(robot) }} · {{ room(robot) }}</span>
                <span class="block text-muted-foreground">{{ robot.goal }}</span>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export class PublicWork {
  protected readonly store = inject(OfficeStore);
  protected readonly strings = STRINGS.publicWork;
  protected readonly name = robotName;
  protected room(robot: Parameters<typeof roomName>[0]): string {
    return roomName(robot, this.store.view().rooms);
  }
}
