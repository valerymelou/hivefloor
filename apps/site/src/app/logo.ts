import { Component } from '@angular/core';

/** The Hivefloor mark. */
@Component({
  selector: 'hf-logo',
  template: `
    <svg
      class="size-6 flex-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffb867"
      stroke-width="2"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />
      <path d="M12 8.5l3 1.75v3.5L12 15.5l-3-1.75v-3.5z" fill="#ffb867" />
    </svg>
  `,
})
export class Logo {}
