/** Where the project lives on GitHub. */
export const REPOSITORY = 'https://github.com/valerymelou/hivefloor';

/** The attributes `scripts/sync-docs.mjs` writes for each guide. */
export interface GuideAttributes {
  readonly title: string;
  readonly slug: string;
  readonly order: number;
}

/** Every piece of copy on the landing page, in one place. */
export const COPY = {
  brand: 'Hivefloor',
  nav: { docs: 'Docs', office: 'Live office', source: 'GitHub' },
  hero: {
    title: 'Watch your Claude Code sessions at work',
    body: 'A self-hostable 3D office. Each session is a robot at a desk, in a room for its project, doing the kind of work it is doing right now. It runs on Cloudflare’s free plan.',
    start: 'Set up your office',
    live: 'Open the live office',
    frame: 'The maintainer’s live office',
  },
  features: [
    {
      title: 'Live, not logged',
      body: 'Robots sit, walk to the coffee corner and leave as your sessions work. Subagents take seats at the team table.',
    },
    {
      title: 'Private by design',
      body: 'Private projects send only which robot, what kind of work and when. Paths, commands, prompts and file contents never leave your machine.',
    },
    {
      title: 'Yours to host',
      body: 'One Cloudflare Worker and one small CLI hook. No account with us, no servers to run, and nothing slows Claude Code down.',
    },
  ],
  steps: {
    title: 'Get started',
    body: 'From a clone of the repository:',
    guide: 'Read the setup guide',
    code: 'cp office.config.example.json office.config.json\nnpx hivefloor deploy\nnpx hivefloor init --url https://your-office.example.com',
  },
  docs: { title: 'Documentation', body: 'Everything you need to run your own office.' },
  footer:
    'MIT licensed. Hivefloor is an independent project and is not affiliated with or endorsed by Anthropic.',
} as const;
