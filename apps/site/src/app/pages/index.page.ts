import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COPY } from '../content';
import { buttonVariants } from '../ui/button/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card/card';

/** The landing page, with the live office as its hero. */
@Component({
  selector: 'hf-landing',
  imports: [Card, CardContent, CardHeader, CardTitle, RouterLink],
  template: `
    <section class="mx-auto max-w-5xl px-4 pt-12 pb-8">
      <h1 class="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {{ copy.hero.title }}
      </h1>
      <p class="mt-4 max-w-2xl text-lg text-muted-foreground">{{ copy.hero.body }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <a routerLink="/docs/self-hosting" [class]="primary">{{ copy.hero.start }}</a>
        <a href="/office/" [class]="outline">{{ copy.hero.live }}</a>
      </div>
    </section>
    <section class="mx-auto max-w-5xl px-4">
      <iframe
        src="/office/#embed"
        [title]="copy.hero.frame"
        loading="lazy"
        class="aspect-video w-full rounded-xl border bg-[#0c0f1d]"
      ></iframe>
    </section>
    <section class="mx-auto grid max-w-5xl gap-4 px-4 py-12 md:grid-cols-3">
      @for (feature of copy.features; track feature.title) {
        <div ndCard>
          <div ndCardHeader>
            <h2 ndCardTitle>{{ feature.title }}</h2>
          </div>
          <p ndCardContent class="text-sm text-muted-foreground">{{ feature.body }}</p>
        </div>
      }
    </section>
    <section class="mx-auto max-w-5xl px-4 pb-16">
      <h2 class="text-2xl font-semibold">{{ copy.steps.title }}</h2>
      <p class="mt-2 text-muted-foreground">{{ copy.steps.body }}</p>
      <pre
        class="mt-4 overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-sm"
        tabindex="0"
      ><code>{{ copy.steps.code }}</code></pre>
      <a routerLink="/docs/self-hosting" [class]="outline + ' mt-4'">{{ copy.steps.guide }}</a>
    </section>
  `,
})
export default class LandingPage {
  protected readonly copy = COPY;
  protected readonly primary = buttonVariants({ variant: 'default' });
  protected readonly outline = buttonVariants({ variant: 'outline' });
}
