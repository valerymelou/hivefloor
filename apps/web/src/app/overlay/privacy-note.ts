import { Component } from '@angular/core';
import { STRINGS } from '../core/strings';

/** The privacy promise, always on screen (W5). */
@Component({
  selector: 'hf-privacy-note',
  template: `
    <p class="flex gap-2 border-t pt-3 text-[0.8125rem] leading-snug text-muted-foreground">
      <svg
        class="mt-0.5 size-3.5 flex-none text-primary"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span>{{ strings.body }}</span>
    </p>
  `,
})
export class PrivacyNote {
  protected readonly strings = STRINGS.privacy;
}
