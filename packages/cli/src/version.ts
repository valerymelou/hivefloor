import packageJson from '../package.json' with { type: 'json' };

/** The CLI's version, from its package.json. */
export const VERSION: string = packageJson.version;
