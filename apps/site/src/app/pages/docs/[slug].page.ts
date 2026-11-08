import { injectContent, MarkdownComponent } from '@analogjs/content';
import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import type { GuideAttributes } from '../../content';

/** One guide, rendered from the Markdown in `docs/`. */
@Component({
  selector: 'hf-guide',
  imports: [AsyncPipe, MarkdownComponent],
  template: `
    <article class="hf-prose mx-auto max-w-3xl px-4 py-12">
      @if (guide | async; as file) {
        <analog-markdown [content]="file.content" />
      }
    </article>
  `,
})
export default class GuidePage {
  protected readonly guide = injectContent<GuideAttributes>({
    param: 'slug',
    subdirectory: 'docs',
  });
}
