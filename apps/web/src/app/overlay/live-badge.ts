import { Component, computed, inject, input } from '@angular/core';
import { OfficeStore } from '../core/office-store';
import { STRINGS } from '../core/strings';
import { Badge } from '../ui/badge/badge';

/** The small live badge shown over the office when embedded; links to the full office. */
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

  /** Says plainly when the robots are simulated, for the landing page. */
  readonly labelDemo = input(false);

  protected readonly text = computed(() => {
    const state = this.store.connection();
    if (state === 'demo' && this.labelDemo()) return STRINGS.connection.demoNotice;
    return state === 'live' || state === 'demo'
      ? STRINGS.agentsWorking(this.store.activeCount())
      : state === 'closed'
        ? STRINGS.connection.closed(this.store.closedUntil() ?? '00:00')
        : STRINGS.connection[state];
  });
  protected readonly label = computed(() => `${this.text()}. ${STRINGS.scene.openOffice}`);
}
