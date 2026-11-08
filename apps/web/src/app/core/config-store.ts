import { inject, Injectable, signal } from '@angular/core';
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
  private readonly state = signal<OfficeConfig | undefined>(this.demo ? DEMO_CONFIG : undefined);

  /** The config, once loaded. */
  readonly config = this.state.asReadonly();

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
      if (parsed.success) this.state.set(parsed.data);
    } catch {
      // The header falls back to "Hivefloor"; the live connection reports the outage.
    }
  }
}
