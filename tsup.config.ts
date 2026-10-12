import { readFile } from 'node:fs/promises'
import path from 'node:path'
import tailwind from '@tailwindcss/postcss'
import postcss from 'postcss'
import { defineConfig, type Options } from 'tsup'

type EsbuildPlugin = NonNullable<Options['esbuildPlugins']>[number]

// Compiles `*.css?inline` imports with Tailwind and inlines the result as a
// string, so the stylesheet ships inside the JS bundle and gets injected into
// the widget's shadow root at runtime. Mirrors Vite's `?inline` behaviour.
const inlineTailwind: EsbuildPlugin = {
  name: 'inline-tailwind',
  setup(build) {
    // The resolved path keeps its `?inline` suffix so tsup's own CSS plugin
    // (which matches /\.css$/) leaves it alone.
    build.onResolve({ filter: /\.css\?inline$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path),
      namespace: 'inline-css',
    }))
    build.onLoad({ filter: /.*/, namespace: 'inline-css' }, async (args) => {
      const file = args.path.replace(/\?inline$/, '')
      const source = await readFile(file, 'utf8')
      const result = await postcss([tailwind({ optimize: { minify: true } })]).process(source, { from: file })
      return { contents: result.css, loader: 'text' }
    })
  },
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  external: ['react', 'react-dom'],
  esbuildPlugins: [inlineTailwind],
  banner: { js: "'use client';" },
})
