import {
  type ApplicationConfig,
  InjectionToken,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideNdop } from '@ndop/core';
import { pageMode } from './core/modes';
import { provideIcons } from './lib/icons';

/** `true` when the page was opened with `#demo` (W7): the simulator replaces the relay. */
export const DEMO_MODE = new InjectionToken<boolean>('DEMO_MODE', {
  providedIn: 'root',
  factory: () => typeof location !== 'undefined' && pageMode(location.hash).demo,
});

/** Whether the page shows only the office and a live badge, for embedding. */
export const EMBED_MODE = new InjectionToken<boolean>('EMBED_MODE', {
  providedIn: 'root',
  factory: () => typeof location !== 'undefined' && pageMode(location.hash).embed,
});

/** The application's providers. */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideNdop(), provideIcons()],
};
