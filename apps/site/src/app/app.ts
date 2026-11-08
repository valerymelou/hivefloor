import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** The site's frame. Each page draws its own navigation over its own backdrop. */
@Component({
  selector: 'hf-site',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {}
