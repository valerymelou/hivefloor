import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  // Written by ndop verify (scripts/ndop-verify.mjs); never source.
  { ignores: ['.ndop/**'] },
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'hf',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'hf',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // Ndop UI's copied-in source (ndop add / ndop update). Keep it as upstream ships
    // it so updates merge cleanly: its directives use the nd prefix, and its icon
    // list may name icons Lucide has since deprecated.
    files: ['src/app/ui/**/*.ts', 'src/app/lib/**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'nd', style: 'camelCase' },
      ],
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
