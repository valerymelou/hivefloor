import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal, type OnInit } from '@angular/core';
import { DEMO_MODE, EMBED_MODE, SHOWCASE_MODE } from './app.config';
import { ConfigStore, DEMO_CONFIG } from './core/config-store';
import { LiveSource } from './core/live-source';
import { OfficeStore } from './core/office-store';
import { ShowcaseSource } from './core/showcase-source';
import { STRINGS } from './core/strings';
import { lowPowerDevice, webglAvailable, webglRenderer } from './core/webgl';
import { demoSessions, DemoSource } from './demo/demo-source';
import { OfficeCanvas } from './office/office-canvas';
import { ActivityFeed } from './overlay/activity-feed';
import { LiveBadge } from './overlay/live-badge';
import { OfficeHeader } from './overlay/office-header';
import { PrivacyNote } from './overlay/privacy-note';
import { PublicWork } from './overlay/public-work';
import { RobotCard } from './overlay/robot-card';
import { RobotList } from './overlay/robot-list';
import { TodayCounts } from './overlay/today-counts';
import { Button } from './ui/button/button';

/** How many simulated sessions fill the landing page's office while it is empty. */
const SHOWCASE_SESSIONS = 6;

/** Which main view is shown: the 3D office or the list of everyone (W11). */
export type ViewMode = '3d' | 'list';

/**
 * The office page: the 3D office or the list view, with the overlay panels
 * floating over it. Picks the live relay, the simulator with `#demo` (W7), or
 * whichever of the two has robots with `#showcase`.
 */
@Component({
  selector: 'hf-root',
  imports: [
    ActivityFeed,
    Button,
    LiveBadge,
    NgTemplateOutlet,
    OfficeCanvas,
    OfficeHeader,
    PrivacyNote,
    PublicWork,
    RobotCard,
    RobotList,
    TodayCounts,
  ],
  template: `
    <ng-template #pins>
      <aside class="hf-aside flex flex-col gap-4 p-4" [attr.aria-label]="strings.panels">
        <div class="hf-pins-left flex flex-col gap-4">
          <hf-public-work><hf-privacy-note /></hf-public-work>
          <hf-activity-feed />
        </div>
        <div class="hf-pins-right"><hf-today-counts /></div>
      </aside>
    </ng-template>

    @if (embed) {
      <main class="relative h-dvh overflow-hidden bg-background text-foreground">
        @if (mode() === '3d') {
          <hf-office-canvas class="h-full" [showHint]="false" (failed)="sceneFailed()" />
        } @else {
          <p class="p-4 text-sm text-muted-foreground" role="status">{{ notice() }}</p>
        }
        <div class="absolute start-3 top-3 z-10"><hf-live-badge /></div>
        <div class="fixed bottom-3 start-3 z-20">
          @if (selected(); as robot) {
            <hf-robot-card [robot]="robot" />
          }
        </div>
      </main>
    } @else if (showcase) {
      <main
        class="hf-night hf-showcase relative h-dvh overflow-hidden bg-background text-foreground"
        [class.hf-solid]="solid"
      >
        @if (mode() === '3d') {
          <hf-office-canvas class="h-full" [showHint]="false" (failed)="sceneFailed()" />
        } @else {
          <p class="p-4 text-sm text-muted-foreground" role="status">{{ notice() }}</p>
        }
        <div class="hf-showcase-badge absolute start-3 top-3 z-10">
          <hf-live-badge [labelDemo]="true" />
        </div>
        <div class="hidden lg:contents">
          <ng-container [ngTemplateOutlet]="pins" />
        </div>
        <div class="hf-card-pin fixed end-4 bottom-4 z-20">
          @if (selected(); as robot) {
            <hf-robot-card [robot]="robot" />
          }
        </div>
      </main>
    } @else {
      <div
        class="hf-night flex min-h-dvh flex-col bg-background text-foreground"
        [class.hf-solid]="solid"
        [class.hf-stage-page]="mode() === '3d'"
      >
        <hf-office-header>
          <button
            ndButton
            variant="outline"
            size="sm"
            type="button"
            [attr.aria-pressed]="mode() === 'list'"
            [disabled]="!webgl"
            (click)="toggle()"
          >
            {{ strings.showList }}
          </button>
        </hf-office-header>
        @if (notice(); as notice) {
          <p class="px-4 pb-2 text-sm text-muted-foreground" role="status">{{ notice }}</p>
        }
        @if (mode() === '3d') {
          <main>
            <hf-office-canvas class="h-[60dvh]" (failed)="sceneFailed()" />
            <ng-container [ngTemplateOutlet]="pins" />
          </main>
        } @else {
          <main class="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-3">
            <div class="lg:col-span-2"><hf-robot-list /></div>
            <div class="flex flex-col gap-4">
              <hf-public-work><hf-privacy-note /></hf-public-work>
              <hf-activity-feed />
              <hf-today-counts />
            </div>
          </main>
        }
        <div class="hf-card-pin fixed end-4 bottom-4 z-20">
          @if (selected(); as robot) {
            <hf-robot-card [robot]="robot" />
          }
        </div>
      </div>
    }
  `,
})
export class App implements OnInit {
  private readonly store = inject(OfficeStore);
  private readonly configStore = inject(ConfigStore);
  private readonly demo = inject(DEMO_MODE);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly embed = inject(EMBED_MODE);
  protected readonly showcase = inject(SHOWCASE_MODE);
  protected readonly strings = STRINGS.scene;
  protected readonly selected = this.store.selectedRobot;
  protected readonly webgl = webglAvailable();
  protected readonly mode = signal<ViewMode>(this.webgl ? '3d' : 'list');
  protected readonly notice = signal<string | undefined>(
    this.webgl ? undefined : STRINGS.scene.noWebGl,
  );
  /** Slow devices get solid panels: blurring a moving 3D scene costs frames. */
  protected readonly solid = lowPowerDevice((query) => window.matchMedia(query), webglRenderer());

  constructor() {
    if (this.showcase) {
      effect(() => {
        this.configStore.useSimulator(this.store.connection() === 'demo');
      });
    }
  }

  /** Connects to the relay, or starts the simulator in demo mode. */
  ngOnInit(): void {
    const simulator = (sessions: number): DemoSource =>
      new DemoSource(DEMO_CONFIG, undefined, undefined, sessions);
    const live = (): LiveSource =>
      new LiveSource({
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
    const source = this.demo
      ? simulator(demoSessions(location.hash))
      : this.showcase
        ? new ShowcaseSource(live(), simulator(SHOWCASE_SESSIONS), {
            now: Date.now,
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (handle) => {
              clearTimeout(handle as ReturnType<typeof setTimeout>);
            },
          })
        : live();
    void this.configStore.load();
    this.destroyRef.onDestroy(this.store.connect(source));
  }

  /** Switches between the 3D office and the list view (W11). */
  protected toggle(): void {
    this.mode.update((mode) => (mode === '3d' ? 'list' : '3d'));
    this.store.selected.set(undefined);
  }

  /** The 3D office failed to load: show the list instead. */
  protected sceneFailed(): void {
    this.mode.set('list');
    this.notice.set(STRINGS.scene.failed);
  }
}
