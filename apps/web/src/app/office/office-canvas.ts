import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ConfigStore } from '../core/config-store';
import { OfficeStore } from '../core/office-store';
import { STRINGS } from '../core/strings';
import { lowPowerDevice, webglRenderer } from '../core/webgl';
import type { OfficeScene } from '../scene/render/office-scene';

/** Loading, drawing, or failed (the page then shows the list view). */
export type SceneState = 'loading' | 'ready' | 'failed';

/**
 * The 3D office (W1–W4, W8–W10). Wraps the framework-agnostic scene: it loads
 * the Three.js code on demand, so the overlay renders first, and feeds the scene
 * the store's view. The scene runs its own render loop, outside Angular.
 */
@Component({
  selector: 'hf-office-canvas',
  template: `
    <div #stage class="absolute inset-0"></div>
    <div
      #labels
      class="hf-labels pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    ></div>
    @if (state() === 'loading') {
      <p class="absolute inset-0 grid place-items-center font-mono text-sm text-white/70">
        {{ strings.loading }}
      </p>
    }
    <p
      class="pointer-events-none absolute bottom-3 start-3 hidden rounded-md bg-black/50 px-2 py-1 font-mono text-xs text-white/80 sm:block"
    >
      {{ strings.hint }}
    </p>
  `,
  host: { class: 'hf-stage relative block overflow-hidden', '[attr.data-state]': 'state()' },
})
export class OfficeCanvas {
  /** Emitted when the 3D office can't be drawn. */
  readonly failed = output();

  protected readonly strings = STRINGS.scene;
  protected readonly state = signal<SceneState>('loading');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly labels = viewChild.required<ElementRef<HTMLElement>>('labels');
  private readonly store = inject(OfficeStore);
  private readonly configStore = inject(ConfigStore);
  private readonly scene = signal<OfficeScene | undefined>(undefined);
  private destroyed = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.scene()?.dispose();
    });
    afterNextRender(() => {
      void this.start();
    });
    effect(() => {
      const scene = this.scene();
      const config = this.configStore.config();
      const view = this.store.view();
      if (scene !== undefined && config !== undefined) scene.update(view, config);
    });
  }

  private async start(): Promise<void> {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    try {
      const { createOfficeScene } = await import('../scene/render/office-scene');
      const scene = await createOfficeScene({
        stage: this.stage().nativeElement,
        labels: this.labels().nativeElement,
        baseUrl: document.baseURI,
        reducedMotion: motion.matches,
        lowPower: lowPowerDevice((query) => window.matchMedia(query), webglRenderer()),
        onPick: (key) => {
          this.store.selected.set(key);
        },
      });
      if (this.destroyed) {
        scene.dispose();
        return;
      }
      motion.addEventListener('change', (event) => {
        scene.setReducedMotion(event.matches);
      });
      this.scene.set(scene);
      this.state.set('ready');
    } catch (error) {
      console.error(error);
      this.state.set('failed');
      this.failed.emit();
    }
  }
}
