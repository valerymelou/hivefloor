import { computed, inject, Injectable, signal } from '@angular/core';
import { OfficeConfigSchema, type OfficeConfig } from '@hivefloor/schema';
import { exampleOfficeConfig } from '@hivefloor/schema/fixtures';
import { DEMO_MODE } from '../app.config';

/** The demo office: the example config from the repository. */
export const DEMO_CONFIG: OfficeConfig = OfficeConfigSchema.parse(exampleOfficeConfig);

/**
 * The public office config: title, owner, time zone, public projects (R6). In
 * demo mode it is the example office; otherwise it comes from `/api/config`.
 */
@Injectable({ providedIn: 'root' })
export class ConfigStore {
  private readonly demo = inject(DEMO_MODE);
  private readonly loaded = signal<OfficeConfig | undefined>(undefined);
  private readonly simulating = signal(this.demo);

  /** The config, once loaded; the example office while the simulator runs. */
  readonly config = computed(() => (this.simulating() ? DEMO_CONFIG : this.loaded()));

  /**
   * Says whether the simulator is on screen, for the landing page, which switches
   * between it and the real office.
   *
   * @param simulating - `true` while simulated robots are showing.
   */
  useSimulator(simulating: boolean): void {
    this.simulating.set(simulating);
  }

  /**
   * Loads the config from the relay (not needed in demo mode).
   *
   * @param fetcher - `fetch`, injected for tests.
   * @param baseUrl - The page's base URL.
   */
  async load(fetcher: typeof fetch = fetch, baseUrl: string = document.baseURI): Promise<void> {
    if (this.demo) return;
    try {
      const response = await fetcher(new URL('api/config', baseUrl));
      const parsed = OfficeConfigSchema.safeParse(response.ok ? await response.json() : undefined);
      if (parsed.success) this.loaded.set(parsed.data);
    } catch {
      // The header falls back to "Hivefloor"; the live connection reports the outage.
    }
  }
}
