import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Seo } from './seo';

/** The site's frame. Each page draws its own navigation over its own backdrop. */
@Component({
  selector: 'hf-site',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  constructor() {
    inject(Seo).track();
  }
}
