import { Component, DestroyRef, inject, type OnInit } from '@angular/core';
import { DEMO_MODE } from './app.config';
import { ConfigStore, DEMO_CONFIG } from './core/config-store';
import { LiveSource } from './core/live-source';
import { OfficeStore } from './core/office-store';
import { DemoSource } from './demo/demo-source';
import { ActivityFeed } from './overlay/activity-feed';
import { OfficeHeader } from './overlay/office-header';
import { PrivacyNote } from './overlay/privacy-note';
import { PublicWork } from './overlay/public-work';
import { RobotList } from './overlay/robot-list';
import { TodayCounts } from './overlay/today-counts';

/** The office page: header, the list of everyone, and the side panels. */
@Component({
  selector: 'hf-root',
  imports: [ActivityFeed, OfficeHeader, PrivacyNote, PublicWork, RobotList, TodayCounts],
  template: `
    <div class="min-h-dvh bg-background text-foreground">
      <hf-office-header />
      <main class="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-3">
        <div class="lg:col-span-2"><hf-robot-list /></div>
        <div class="flex flex-col gap-4">
          <hf-public-work />
          <hf-activity-feed />
          <hf-today-counts />
          <hf-privacy-note />
        </div>
      </main>
    </div>
  `,
})
export class App implements OnInit {
  private readonly store = inject(OfficeStore);
  private readonly configStore = inject(ConfigStore);
  private readonly demo = inject(DEMO_MODE);
  private readonly destroyRef = inject(DestroyRef);

  /** Loads the config and connects to the relay, or starts the demo. */
  ngOnInit(): void {
    const source = this.demo
      ? new DemoSource(DEMO_CONFIG)
      : new LiveSource({
          baseUrl: document.baseURI,
          createSocket: (url) => new WebSocket(url),
          fetch: (input, init) => fetch(input, init),
          setTimeout: (fn, ms) => setTimeout(fn, ms),
          clearTimeout: (handle) => {
            clearTimeout(handle as ReturnType<typeof setTimeout>);
          },
          random: Math.random,
          now: Date.now,
          timeZone: () => this.configStore.config()?.timezone ?? 'UTC',
        });
    void this.configStore.load();
    this.destroyRef.onDestroy(this.store.connect(source));
  }
}
