import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { COPY, REPOSITORY } from './content';

/** The site's frame: navigation, the current page and the footer. */
@Component({
  selector: 'hf-site',
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="flex min-h-dvh flex-col bg-background text-foreground">
      <header class="border-b">
        <nav class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <a routerLink="/" class="font-semibold">{{ copy.brand }}</a>
          <div class="flex items-center gap-4 text-sm">
            <a routerLink="/docs" class="hover:underline">{{ copy.nav.docs }}</a>
            <a href="/office/" class="hover:underline">{{ copy.nav.office }}</a>
            <a [href]="repository" class="hover:underline">{{ copy.nav.source }}</a>
          </div>
        </nav>
      </header>
      <main class="flex-1"><router-outlet /></main>
      <footer class="border-t">
        <p class="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground">{{ copy.footer }}</p>
      </footer>
    </div>
  `,
})
export class App {
  protected readonly copy = COPY;
  protected readonly repository = REPOSITORY;
}
