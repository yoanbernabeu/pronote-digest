import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { action: 'src/action/main.ts', cli: 'src/cli/main.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  bundle: true,
  noExternal: [/.*/],
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: true,
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
