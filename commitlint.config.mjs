/**
 * Conventional Commits, checked locally by the husky commit-msg hook and in CI.
 * Scopes are optional; when given, they name a project or an area of the repo.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['schema', 'cli', 'relay', 'web', 'web-e2e', 'site', 'docs', 'repo', 'ci', 'deps', 'release'],
    ],
  },
};
