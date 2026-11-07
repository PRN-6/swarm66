import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'DomSwarm',
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  target: 'es2020',
  splitting: false,
  treeshake: true,
  outExtension({ format }) {
    if (format === 'iife') return { js: '.global.js' };
    if (format === 'cjs') return { js: '.cjs' };
    return { js: '.js' };
  },
});
