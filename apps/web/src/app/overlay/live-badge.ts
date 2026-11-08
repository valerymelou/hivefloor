import { Component, computed, inject } from '@angular/core';
import { OfficeStore } from '../core/office-store';
import { STRINGS } from '../core/strings';
import { Badge } from '../ui/badge/badge';

/** The small live badge shown over the office in embed mode; links to the full office. */
@Component({
  selector: 'hf-live-badge',
  imports: [Badge],
  template: `
    <a href="./" target="_top" [attr.aria-label]="label()">
      <span ndBadge variant="secondary">{{ text() }}</span>
    </a>
  `,
})
export class LiveBadge {
  private readonly store = inject(OfficeStore);
  protected readonly text = computed(() => {
    const state = this.store.connection();
    return state === 'live' || state === 'demo'
      ? STRINGS.agentsWorking(this.store.activeCount())
      : state === 'closed'
        ? STRINGS.connection.closed(this.store.closedUntil() ?? '00:00')
        : STRINGS.connection[state];
  });
  protected readonly label = computed(() => `${this.text()}. ${STRINGS.scene.openOffice}`);
}
