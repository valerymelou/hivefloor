import { Component, inject, signal } from '@angular/core';
import { OfficeStore } from '../core/office-store';
import { STRINGS } from '../core/strings';
import { Button } from '../ui/button/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card/card';

/** Entries shown on phones before "Show more" (W12). */
export const COLLAPSED_ENTRIES = 2;

/** The activity feed, announced politely to screen readers (W5). */
@Component({
  selector: 'hf-activity-feed',
  imports: [Button, Card, CardContent, CardHeader, CardTitle],
  template: `
    <section ndCard aria-labelledby="feed-title">
      <div ndCardHeader>
        <h2 ndCardTitle id="feed-title">{{ strings.title }}</h2>
      </div>
      <div ndCardContent>
        @if (store.feed().length === 0) {
          <p class="text-sm text-muted-foreground">{{ strings.empty }}</p>
        }
        <ol
          class="hf-capped flex flex-col gap-1.5 text-sm"
          aria-live="polite"
          aria-relevant="additions"
        >
          @for (entry of store.feed(); track entry.id; let i = $index) {
            <li [class.hidden]="!expanded() && i >= collapsed" class="md:block">
              <span class="hf-dot me-2.5" [style.background]="entry.color"></span>
              <span class="font-medium">{{ entry.who }}</span>
              <span class="text-muted-foreground"> · {{ entry.where }}</span>
              {{ entry.what }}
            </li>
          }
        </ol>
        @if (store.feed().length > collapsed) {
          <button
            ndButton
            variant="link"
            size="sm"
            class="px-0 md:hidden"
            type="button"
            [attr.aria-expanded]="expanded()"
            (click)="expanded.update((v) => !v)"
          >
            {{ expanded() ? strings.showLess : strings.showMore }}
          </button>
        }
      </div>
    </section>
  `,
})
export class ActivityFeed {
  protected readonly store = inject(OfficeStore);
  protected readonly strings = STRINGS.feed;
  protected readonly collapsed = COLLAPSED_ENTRIES;
  /** Whether every entry shows on small screens. */
  readonly expanded = signal(false);
}
