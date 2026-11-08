import { Component, computed, inject } from '@angular/core';
import { PRIVATE_ROOM_ID, slugify } from '@hivefloor/schema';
import { ConfigStore } from '../core/config-store';
import { OfficeStore } from '../core/office-store';
import { STRINGS } from '../core/strings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table/table';

/** Today's tool use per room and category (W5, R8). */
@Component({
  selector: 'hf-today-counts',
  imports: [
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  ],
  template: `
    <section ndCard aria-labelledby="today-title">
      <div ndCardHeader>
        <h2 ndCardTitle id="today-title">{{ strings.title }}</h2>
        <p ndCardDescription>{{ strings.description }}</p>
      </div>
      <div ndCardContent>
        @if (rows().length === 0) {
          <p class="text-sm text-muted-foreground">{{ strings.empty }}</p>
        } @else {
          <table ndTable>
            <thead ndTableHeader>
              <tr ndTableRow>
                <th ndTableHead scope="col">{{ strings.room }}</th>
                <th ndTableHead scope="col">{{ strings.category }}</th>
                <th ndTableHead scope="col" class="text-end">{{ strings.count }}</th>
              </tr>
            </thead>
            <tbody ndTableBody>
              @for (row of rows(); track row.key) {
                <tr ndTableRow>
                  <td ndTableCell>{{ row.room }}</td>
                  <td ndTableCell>{{ row.category }}</td>
                  <td ndTableCell class="text-end tabular-nums">{{ row.n }}</td>
                </tr>
              }
            </tbody>
          </table>
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
    const nameOf = (id: string): string =>
      rooms.find((r) => r.id === id)?.name ??
      projects.find((p) => slugify(p.name) === id)?.name ??
      id;
    return this.store.today().map((count) => ({
      key: `${count.room}:${count.cat}`,
      room: count.room === PRIVATE_ROOM_ID ? STRINGS.privateProject : nameOf(count.room),
      category: STRINGS.categories[count.cat],
      n: count.n,
    }));
  });
}
