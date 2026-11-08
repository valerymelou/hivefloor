import { injectContentFiles } from '@analogjs/content';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { COPY, GUIDE_COLORS, REPOSITORY, type GuideAttributes } from '../content';
import { Logo } from '../logo';

/**
 * The frame around every guide: a banner cut from the office, the list of guides
 * and the guide itself. Analog makes each Markdown file in `src/content` a route
 * of its own, so this is where they get their layout.
 */
@Component({
  selector: 'hf-docs',
  imports: [Logo, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="hf-night min-h-dvh bg-background text-foreground">
      <header class="hf-banner relative flex min-h-80 flex-col justify-between gap-6 p-4 lg:p-6">
        <nav
          class="hf-glass flex flex-wrap items-center justify-between gap-2 p-1.5 ps-4"
          aria-label="Main"
        >
          <a routerLink="/" class="inline-flex items-center gap-2.5 text-lg font-bold">
            <hf-logo />
            {{ copy.brand }}
          </a>
          <div class="flex flex-wrap gap-1">
            <a routerLink="/docs" class="hf-navlink">{{ copy.nav.docs }}</a>
            <a href="/office/" class="hf-navlink">{{ copy.nav.office }}</a>
            <a [href]="repository" class="hf-navlink">{{ copy.nav.source }}</a>
            <a routerLink="/docs/self-hosting" class="hf-navlink hf-cta">{{ copy.nav.start }}</a>
          </div>
        </nav>
        <div class="hf-glass max-w-xl px-6 py-5">
          <p class="font-mono text-xs tracking-widest text-[#ffcf94] uppercase">
            {{ copy.docs.eyebrow }}
          </p>
          <h1 class="mt-1.5 text-4xl font-bold tracking-tight lg:text-[2.75rem]">{{ title() }}</h1>
          <p class="mt-2 text-lg leading-snug text-foreground/90">{{ description() }}</p>
        </div>
      </header>
      <div class="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 lg:flex-row lg:gap-12">
        <aside class="lg:w-60 lg:flex-none" [attr.aria-label]="copy.docs.guides">
          <p class="mb-2 ms-3 font-mono text-xs font-semibold tracking-widest uppercase">
            {{ copy.docs.guides }}
          </p>
          <nav class="grid gap-0.5">
            @for (guide of guides; track guide.slug) {
              <a
                [routerLink]="['/docs', guide.slug]"
                routerLinkActive="hf-guide-on"
                class="hf-guide"
              >
                <span class="hf-dot" [style.background]="color(guide.slug)"></span>
                {{ guide.attributes.title }}
              </a>
            }
          </nav>
        </aside>
        <article class="hf-prose max-w-3xl min-w-0 flex-1"><router-outlet /></article>
      </div>
      <footer class="px-6 pb-8 text-center text-[0.8125rem] text-muted-foreground">
        {{ copy.credits.legal }} ·
        <a [href]="copy.credits.url" class="underline underline-offset-2">{{ copy.credits.all }}</a>
      </footer>
    </div>
  `,
})
export default class DocsLayout {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly copy = COPY;
  protected readonly repository = REPOSITORY;
  protected readonly guides = injectContentFiles<GuideAttributes>((file) =>
    file.filename.includes('/docs/'),
  ).sort((a, b) => a.attributes.order - b.attributes.order);

  private readonly current = computed(() => {
    const slug = this.url().split(/[?#]/)[0]?.split('/').pop();
    return this.guides.find((guide) => guide.slug === slug);
  });
  protected readonly title = computed(() => this.current()?.attributes.title ?? COPY.docs.title);
  protected readonly description = computed(
    () => this.current()?.attributes.description ?? COPY.docs.body,
  );

  protected color(slug: string | undefined): string {
    return GUIDE_COLORS[slug ?? ''] ?? '#a9abc4';
  }
}
