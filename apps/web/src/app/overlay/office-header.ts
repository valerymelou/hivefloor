import { Component, computed, inject } from '@angular/core';
import { ConfigStore } from '../core/config-store';
import { OfficeStore } from '../core/office-store';
import { STRINGS } from '../core/strings';
import { Badge, type BadgeVariant } from '../ui/badge/badge';

/**
 * The page header: office title and owner, agent counts and the connection state
 * (W5, W6). Projected content, such as the view switch, goes at the end.
 */
@Component({
  selector: 'hf-office-header',
  imports: [Badge],
  template: `
    <header class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div>
        <h1 class="text-lg font-semibold">{{ title() }}</h1>
        @if (owner(); as owner) {
          <p class="text-sm text-muted-foreground">{{ owner }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span ndBadge variant="secondary">{{ working() }}</span>
        <span ndBadge variant="outline">{{ total() }}</span>
        <span ndBadge [variant]="statusVariant()" role="status">{{ status() }}</span>
        <ng-content />
      </div>
    </header>
  `,
})
export class OfficeHeader {
  private readonly store = inject(OfficeStore);
  private readonly configStore = inject(ConfigStore);

  protected readonly title = computed(() => this.configStore.config()?.title ?? 'Hivefloor');
  protected readonly owner = computed(() => this.configStore.config()?.owner);
  protected readonly working = computed(() => STRINGS.agentsWorking(this.store.activeCount()));
  protected readonly total = computed(() => STRINGS.agentsTotal(this.store.view().robots.length));
  protected readonly status = computed(() => {
    const state = this.store.connection();
    return state === 'closed'
      ? STRINGS.connection.closed(this.store.closedUntil() ?? '00:00')
      : STRINGS.connection[state];
  });
  protected readonly statusVariant = computed((): BadgeVariant => {
    const state = this.store.connection();
    return state === 'live' || state === 'demo'
      ? 'default'
      : state === 'closed'
        ? 'destructive'
        : 'outline';
  });
}
