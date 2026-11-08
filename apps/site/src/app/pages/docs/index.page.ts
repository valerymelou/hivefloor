import { injectContentFiles } from '@analogjs/content';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE_COLORS, type GuideAttributes } from '../../content';

/** The list of guides. */
@Component({
  selector: 'hf-docs-index',
  imports: [RouterLink],
  template: `
    <ul class="grid gap-3 sm:grid-cols-2">
      @for (guide of guides; track guide.slug) {
        <li>
          <a [routerLink]="['/docs', guide.slug]" class="hf-guide-card">
            <span class="flex items-center gap-2.5 font-semibold">
              <span class="hf-dot" [style.background]="color(guide.slug)"></span>
              {{ guide.attributes.title }}
            </span>
            <span class="mt-1 block text-sm text-muted-foreground">{{
              guide.attributes.description
            }}</span>
          </a>
        </li>
      }
    </ul>
  `,
})
export default class DocsIndexPage {
  protected readonly guides = injectContentFiles<GuideAttributes>((file) =>
    file.filename.includes('/docs/'),
  ).sort((a, b) => a.attributes.order - b.attributes.order);

  protected color(slug: string | undefined): string {
    return GUIDE_COLORS[slug ?? ''] ?? '#a9abc4';
  }
}
