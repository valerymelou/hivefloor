import {
  type ApplicationConfig,
  InjectionToken,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideNdop } from '@ndop/core';
import { provideIcons } from './lib/icons';

/** `true` when the page was opened with `#demo` (W7): the simulator replaces the relay. */
export const DEMO_MODE = new InjectionToken<boolean>('DEMO_MODE', {
  providedIn: 'root',
  factory: () => typeof location !== 'undefined' && location.hash === '#demo',
});

/** The application's providers. */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideNdop(), provideIcons()],
};
