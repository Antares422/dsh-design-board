// Browser half: bundle src/ into client.js wrapped for DSH's __ModuleLoader__ (React shared from host; xyflow etc. inlined).
// Host half: bundle src/host.js into index.js with skills/*.md inlined.
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const { outputFiles } = await build({
  entryPoints: ['src/index.jsx'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  loader: { '.css': 'text' },
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
})

const code = `/* Generated file, do not edit by hand: source lives in src/, run npm run build to regenerate. */
window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory(require){var module={exports:{}};(function(module,exports,require){${outputFiles[0].text}})(module,module.exports,require);return module.exports.default||module.exports}});
`
writeFileSync('client.js', code)
console.log(`client.js ${(code.length / 1024).toFixed(0)} KB`)

await build({
  entryPoints: ['src/host.js'],
  outfile: 'index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  loader: { '.md': 'text' },
  banner: { js: '/* Generated file, do not edit by hand: source lives in src/host.js and skills/, run npm run build to regenerate. */' },
})
console.log('index.js')
