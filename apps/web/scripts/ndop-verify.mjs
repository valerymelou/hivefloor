// Runs `ndop verify` on the office app. Ndop's verify needs an Angular CLI
// workspace (angular.json), which an Nx workspace doesn't have, so this writes a
// temporary one for apps/web, runs verify, and removes it again. Nx never sees
// the file: it only exists while verify runs.
//
// Usage: node apps/web/scripts/ndop-verify.mjs [ndop verify options]
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const app = join(import.meta.dirname, '..');
const angularJson = join(app, 'angular.json');
const tsconfig = join(app, 'tsconfig.ndop-verify.json');

const workspace = {
  version: 1,
  newProjectRoot: '',
  projects: {
    web: {
      projectType: 'application',
      root: '',
      sourceRoot: 'src',
      prefix: 'hf',
      architect: {
        build: {
          builder: '@angular/build:application',
          options: {
            outputPath: '../../dist/ndop-verify/web',
            browser: 'src/main.ts',
            tsConfig: 'tsconfig.ndop-verify.json',
            assets: [{ glob: '**/*', input: 'public' }],
            styles: ['src/styles.css'],
          },
        },
      },
    },
  },
};

// Ndop's generated render harness has an unused import, which our strict
// noUnusedLocals would reject; everything else keeps the app's settings.
const verifyTsconfig = {
  extends: './tsconfig.app.json',
  compilerOptions: { noUnusedLocals: false },
};

try {
  writeFileSync(angularJson, `${JSON.stringify(workspace, null, 2)}\n`);
  writeFileSync(tsconfig, `${JSON.stringify(verifyTsconfig, null, 2)}\n`);
  const result = spawnSync(
    'pnpm',
    ['exec', 'ndop', 'verify', 'src/app', ...process.argv.slice(2)],
    {
      cwd: app,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(angularJson, { force: true });
  rmSync(tsconfig, { force: true });
}
