import { injectContentFiles } from '@analogjs/content';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COPY, type GuideAttributes } from '../../content';

/** The list of guides. */
@Component({
  selector: 'hf-docs-index',
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-3xl font-semibold">{{ copy.title }}</h1>
      <p class="mt-2 text-muted-foreground">{{ copy.body }}</p>
      <ul class="mt-6 space-y-2">
        @for (guide of guides; track guide.slug) {
          <li>
            <a [routerLink]="['/docs', guide.slug]" class="underline underline-offset-4">{{
              guide.attributes.title
            }}</a>
          </li>
        }
      </ul>
    </div>
  `,
})
export default class DocsIndexPage {
  protected readonly copy = COPY.docs;
  protected readonly guides = injectContentFiles<GuideAttributes>((file) =>
    file.filename.includes('/docs/'),
  ).sort((a, b) => a.attributes.order - b.attributes.order);
}
