import { Component, computed, inject } from '@angular/core';
import { PRIVATE_ROOM_ID, slugify } from '@hivefloor/schema';
import { ConfigStore } from '../core/config-store';
import { OfficeStore } from '../core/office-store';
import { NEUTRAL_ROOM_COLOR, totalsByRoom } from '../core/office-view';
import { STRINGS } from '../core/strings';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card/card';

/** Today's tool use per room, as bars in the room's colour (W5, R8). */
@Component({
  selector: 'hf-today-counts',
  imports: [Card, CardContent, CardHeader, CardTitle],
  template: `
    <section ndCard aria-labelledby="today-title">
      <div ndCardHeader>
        <h2 ndCardTitle id="today-title">{{ strings.title }}</h2>
      </div>
      <div ndCardContent>
        @if (rows().length === 0) {
          <p class="text-sm text-muted-foreground">{{ strings.empty }}</p>
        } @else {
          <ul class="hf-capped flex flex-col gap-2.5 font-mono text-xs">
            @for (row of rows(); track row.key) {
              <li>
                <span class="mb-1 flex justify-between gap-3">
                  <span class="uppercase">{{ row.room }}</span>
                  <span class="tabular-nums">{{ row.n }}</span>
                </span>
                <span class="block h-1.5 overflow-hidden rounded bg-white/12" aria-hidden="true">
                  <span
                    class="block h-full rounded"
                    [style.width.%]="row.share"
                    [style.background]="row.color"
                  ></span>
                </span>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export class TodayCounts {
  private readonly store = inject(OfficeStore);
  private readonly configStore = inject(ConfigStore);
  protected readonly strings = STRINGS.today;
  protected readonly rows = computed(() => {
    const rooms = this.store.view().rooms;
    // A room that closed earlier today still has counts: name it from the config.
    const projects = this.configStore.config()?.publicProjects ?? [];
    const project = (id: string) => projects.find((p) => slugify(p.name) === id);
    const totals = totalsByRoom(this.store.today());
    const largest = totals[0]?.n ?? 1;
    return totals.map(({ room, n }) => ({
      key: room,
      room:
        room === PRIVATE_ROOM_ID
          ? STRINGS.privateProject
          : (rooms.find((r) => r.id === room)?.name ?? project(room)?.name ?? room),
      color: rooms.find((r) => r.id === room)?.color ?? project(room)?.color ?? NEUTRAL_ROOM_COLOR,
      n,
      share: (n / largest) * 100,
    }));
  });
}
