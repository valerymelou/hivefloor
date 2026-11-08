/**
 * Conventional Commits, checked locally by the husky commit-msg hook and in CI.
 * Scopes are optional; when given, they name a project or an area of the repo.
 */

/**
 * Dependabot writes subjects such as `chore(deps-dev): Bump vitest from 5.0.5 to 5.1.0`.
 * The capitalised "Bump" breaks `subject-case` and can't be configured, so those
 * messages (and PR titles) are skipped. Every other commit is checked in full.
 *
 * @param {string} message The raw commit message or PR title.
 * @returns {boolean} Whether commitlint should skip the message.
 */
const isDependabotBump = (message) => /^(chore|ci|build)\(deps(-dev)?\): Bump /.test(message);

export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [isDependabotBump],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'schema',
        'cli',
        'relay',
        'web',
        'web-e2e',
        'site',
        'docs',
        'repo',
        'ci',
        'deps',
        'deps-dev',
        'release',
      ],
    ],
  },
};
