// The relay's bindings, merged into the Workers runtime's global types, so `env`
// and `exports` from "cloudflare:workers" are typed in the Worker and in tests.
// A global declaration file can only reference modules through import() types.
/* eslint-disable @typescript-eslint/consistent-type-imports */
declare namespace Cloudflare {
  interface Env {
    readonly OFFICE: DurableObjectNamespace<import('./office').Office>;
    /** The validated office.config.json as JSON, set by `hivefloor deploy` (ADR 0012). */
    readonly OFFICE_CONFIG?: string;
    /** Where the office is served, such as `/office`. Absent at the root. */
    readonly BASE_PATH?: string;
    /** The shared secret, set with `wrangler secret put HIVEFLOOR_SECRET`. */
    readonly HIVEFLOOR_SECRET?: string;
  }
  interface GlobalProps {
    mainModule: typeof import('./index');
    durableNamespaces: 'Office';
  }
}
