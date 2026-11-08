import type { Env } from './env.js';
import { app } from './app.js';
import { withoutBasePath } from './base-path.js';

// The main module may only export handlers and Durable Object classes: workerd
// rejects any other export, so routes and constants live in app.ts.
export { Office } from './office.js';

export default {
  fetch: (request, env, ctx) => app.fetch(withoutBasePath(request, env.BASE_PATH), env, ctx),
} satisfies ExportedHandler<Env>;
