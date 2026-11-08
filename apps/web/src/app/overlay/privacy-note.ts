import { Component } from '@angular/core';
import { STRINGS } from '../core/strings';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert/alert';

/** The privacy promise, always on screen (W5). */
@Component({
  selector: 'hf-privacy-note',
  imports: [Alert, AlertDescription, AlertTitle],
  template: `
    <aside ndAlert role="none">
      <h2 ndAlertTitle>{{ strings.title }}</h2>
      <p ndAlertDescription>{{ strings.body }}</p>
    </aside>
  `,
})
export class PrivacyNote {
  protected readonly strings = STRINGS.privacy;
}
