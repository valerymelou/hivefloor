/**
 * The Hivefloor contract: schemas, types, constants and the layout function
 * shared by the CLI, the relay and the web app.
 *
 * @packageDocumentation
 */
export * from './constants.js';
export * from './ingest-event.js';
export { configJsonSchema } from './json-schema.js';
export * from './layout/index.js';
export * from './machine-config.js';
export * from './messages.js';
export * from './office-config.js';
export * from './primitives.js';
export {
  compareText,
  fnv1a,
  hasControlChars,
  looksLikeLink,
  NEUTRAL_COLOR,
  projectColor,
  slugify,
} from './text.js';
export { CONTRACT_VERSION, type ContractVersion } from './version.js';
