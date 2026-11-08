import { Component, computed, inject } from '@angular/core';
import { Clock } from '../core/clock';
import { OfficeStore } from '../core/office-store';
import { activity, robotName, roomName } from '../core/office-view';
import { STRINGS } from '../core/strings';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table/table';

/**
 * Everyone in the office as an accessible table (W11): the equivalent of the 3D
 * scene for screen readers, and the main view until the scene arrives.
 */
@Component({
  selector: 'hf-robot-list',
  imports: [
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  ],
  template: `
    <section ndCard aria-labelledby="list-title">
      <div ndCardHeader>
        <h2 ndCardTitle id="list-title">{{ strings.title }}</h2>
      </div>
      <div ndCardContent>
        @if (rows().length === 0) {
          <p class="text-sm text-muted-foreground">{{ strings.empty }}</p>
        } @else {
          <table ndTable>
            <caption ndTableCaption class="sr-only">
              {{
                strings.caption
              }}
            </caption>
            <thead ndTableHeader>
              <tr ndTableRow>
                <th ndTableHead scope="col">{{ strings.who }}</th>
                <th ndTableHead scope="col">{{ strings.room }}</th>
                <th ndTableHead scope="col">{{ strings.status }}</th>
                <th ndTableHead scope="col">{{ strings.goal }}</th>
                <th ndTableHead scope="col">{{ strings.since }}</th>
              </tr>
            </thead>
            <tbody ndTableBody>
              @for (row of rows(); track row.key) {
                <tr ndTableRow>
                  <th ndTableCell scope="row" class="font-medium" [class.ps-6]="row.subagent">
                    {{ row.who }}
                  </th>
                  <td ndTableCell>{{ row.room }}</td>
                  <td ndTableCell>{{ row.activity }}</td>
                  <td ndTableCell class="max-w-64 truncate">{{ row.goal }}</td>
                  <td ndTableCell class="whitespace-nowrap">{{ row.since }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </section>
  `,
})
export class RobotList {
  private readonly store = inject(OfficeStore);
  private readonly clock = inject(Clock);
  protected readonly strings = STRINGS.list;
  protected readonly rows = computed(() => {
    const rooms = this.store.view().rooms;
    const now = this.clock.now();
    return this.store.robots().map((robot) => ({
      key: robot.key,
      who: robotName(robot),
      subagent: robot.parent !== undefined,
      room: roomName(robot, rooms),
      activity: activity(robot),
      goal: robot.goal ?? '',
      since: STRINGS.duration(Math.max(0, now - robot.since)),
    }));
  });
}
