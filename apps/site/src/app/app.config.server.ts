import { mergeApplicationConfig, type ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

/** The providers used when pre-rendering pages. */
export const config: ApplicationConfig = mergeApplicationConfig(appConfig, {
  providers: [provideServerRendering()],
});
