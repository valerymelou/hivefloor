/** Where the project lives on GitHub. */
export const REPOSITORY = 'https://github.com/valerymelou/hivefloor';

/** The attributes `scripts/sync-docs.mjs` writes for each guide. */
export interface GuideAttributes {
  readonly title: string;
  readonly description: string;
  readonly slug: string;
  readonly order: number;
}

/** Each guide's marker colour, from the office's rooms. */
export const GUIDE_COLORS: Readonly<Record<string, string>> = {
  'self-hosting': '#ffb867',
  configuration: '#b79cff',
  'configuration-reference': '#b79cff',
  troubleshooting: '#a9abc4',
  privacy: '#6ee7b7',
  hooks: '#6ea8ff',
  'character-sets': '#f49a8c',
  architecture: '#6ea8ff',
};

/** Every piece of copy on the site's own pages, in one place. */
export const COPY = {
  brand: 'Hivefloor',
  pitch: 'Your Claude Code sessions, live, as robots in a 3D office you host yourself.',
  nav: { docs: 'Docs', office: 'Full office', source: 'GitHub', start: 'Run your own' },
  frame: 'The live office, or a simulated one while nobody is working',
  credits: {
    line: 'Robots by Tomás Laulhé (Quaternius), CC0 · Three.js · Angular · Cloudflare Workers',
    legal: 'MIT licence · Not affiliated with or endorsed by Anthropic',
    all: 'All credits',
    url: `${REPOSITORY}/blob/main/THIRD_PARTY_NOTICES.md`,
  },
  docs: {
    eyebrow: 'Guide',
    title: 'Documentation',
    body: 'Everything you need to run your own office.',
    guides: 'Guides',
  },
} as const;
