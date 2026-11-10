import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { COPY, REPOSITORY } from '../content';
import { Logo } from '../logo';

/** Sizes the office's frame, whichever of the two is showing. */
const FRAME_CLASS =
  'hf-poster order-2 h-[100vw] max-h-[70dvh] min-h-72 w-full rounded-xl border-0 lg:absolute lg:inset-0 lg:h-full lg:max-h-none lg:rounded-none';

/**
 * The landing page: the office itself, filling the screen, with the project's
 * name, links and credits floating over it. `/#demo` shows the simulator instead
 * of the live office. Each mode is its own frame, because the office reads its
 * hash once when it starts.
 */
@Component({
  selector: 'hf-landing',
  imports: [Logo, RouterLink],
  template: `
    <div
      class="hf-night flex min-h-dvh flex-col gap-3 bg-background p-4 text-foreground lg:relative lg:block lg:h-dvh lg:overflow-hidden lg:p-0"
    >
      @if (demo()) {
        <iframe src="/office/#showcase&demo" [title]="copy.frame" [class]="frameClass"></iframe>
      } @else {
        <iframe src="/office/#showcase" [title]="copy.frame" [class]="frameClass"></iframe>
      }
      <header class="hf-glass order-1 p-4 lg:absolute lg:start-6 lg:top-4 lg:w-72 lg:p-3">
        <div class="flex items-center gap-2.5">
          <hf-logo />
          <h1 class="text-xl font-bold tracking-tight">{{ copy.brand }}</h1>
        </div>
        <p class="mt-1.5 text-sm leading-snug text-foreground/90">{{ copy.pitch }}</p>
      </header>
      <nav
        class="hf-glass order-3 flex flex-wrap items-center gap-1 p-1.5 lg:absolute lg:end-6 lg:top-5"
        aria-label="Main"
      >
        <a routerLink="/docs" class="hf-navlink">{{ copy.nav.docs }}</a>
        <a href="/office/" class="hf-navlink">{{ copy.nav.office }}</a>
        <a [href]="repository" class="hf-navlink">{{ copy.nav.source }}</a>
        <a routerLink="/docs/self-hosting" class="hf-navlink hf-cta">{{ copy.nav.start }}</a>
      </nav>
      <footer
        class="hf-glass order-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 text-xs text-muted-foreground lg:absolute lg:end-6 lg:bottom-4"
      >
        <span>{{ copy.credits.line }}</span>
        <span>
          {{ copy.credits.legal }} ·
          <a [href]="copy.credits.url" class="underline underline-offset-2">{{
            copy.credits.all
          }}</a>
        </span>
      </footer>
    </div>
  `,
})
export default class LandingPage {
  protected readonly copy = COPY;
  protected readonly repository = REPOSITORY;
  protected readonly frameClass = FRAME_CLASS;
  /** Whether the address asks for the simulator, with `#demo`. */
  protected readonly demo = signal(false);

  constructor() {
    const route = inject(ActivatedRoute);
    const destroyRef = inject(DestroyRef);
    // After the first render: the pre-rendered page always has the normal office,
    // and hydration has to find that same frame before it can be swapped.
    afterNextRender(() => {
      route.fragment.pipe(takeUntilDestroyed(destroyRef)).subscribe((fragment) => {
        this.demo.set(fragment === 'demo');
      });
    });
  }
}
