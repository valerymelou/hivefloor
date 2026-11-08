import { defineConfig } from 'tsdown';

// One self-contained ESM file: @hivefloor/schema and Zod are bundled in, so the
// published package has zero runtime dependencies. Zod sits in a separate chunk
// that is only loaded when the machine config changes.
export default defineConfig({
  entry: { bin: 'src/bin.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node20',
  tsconfig: 'tsconfig.lib.json',
  outDir: '../../dist/packages/cli',
  clean: true,
  minify: true,
  dts: false,
  sourcemap: false,
  fixedExtension: true,
  deps: { alwaysBundle: [/./] },
  copy: [
    'package.json',
    'README.md',
    { from: '../../LICENSE', to: '../../dist/packages/cli' },
    // The machine config's $schema points at https://unpkg.com/hivefloor/machine.schema.json.
    { from: '../schema/machine.schema.json', to: '../../dist/packages/cli' },
  ],
});
