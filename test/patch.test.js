// Validates cordis.patch.yml and package.json against the shape documented for
// @deepseek-ai/dsh-mcp-client (streamable-http config) and the dsh.bundle manifest.
// No network, no model calls. Run: npm install && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import YAML from 'yaml'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

// `!!js <expr>` is evaluated by DSH with `process.env`; evaluate it the same way here.
const jsTag = { tag: 'tag:yaml.org,2002:js', resolve: (s) => ({ js: s }) }
const patch = YAML.parse(readFileSync(path.join(root, pkg.dsh.bundle.patch), 'utf8'), {
  customTags: [jsTag],
  schema: 'core',
})
const ALLOWED = new Set(['serverName', 'transport', 'url', 'headers', 'toolCallTimeoutMs',
  'maxInstructionBytes', 'failOnStartupError', 'reconnect'])
const row = patch?.[0]?.insert?.[0]

test('package.json declares a dsh.bundle patch that exists', () => {
  assert.equal(typeof pkg.dsh?.bundle?.patch, 'string')
  assert.ok(existsSync(path.join(root, pkg.dsh.bundle.patch)))
  assert.ok(pkg.keywords.includes('dsh-plugin'))
})

test('patch is one insert row for dsh-mcp-client', () => {
  assert.equal(patch.length, 1)
  assert.equal(patch[0].insert.length, 1)
  assert.equal(row.name, '@deepseek-ai/dsh-mcp-client')
  assert.match(row.id, /^[a-z0-9-]+$/)
})

test('config matches the streamable-http schema', () => {
  const c = row.config
  assert.equal(c.transport, 'streamable-http')
  assert.match(c.serverName, /^[A-Za-z0-9_-]{1,32}$/)
  assert.equal(c.url, 'https://mcp.renor.cloud/mcp')
  for (const k of Object.keys(c)) assert.ok(ALLOWED.has(k), `unknown config field ${k}`)
  for (const k of ['command', 'args', 'env', 'cwd']) assert.ok(!(k in c), `${k} is stdio-only`)
})

test('the key comes from the environment and is never a literal', () => {
  const expr = row.config.headers.Authorization.js
  assert.ok(expr, 'Authorization must be a !!js expression')
  const run = (env) => new Function('process', `return (${expr})`)({ env })
  assert.equal(run({ RENOR_API_KEY: 'k123' }), 'Bearer k123')
  assert.equal(run({}), '') // no key: no "Bearer undefined"
  assert.ok(!/Bearer\s+[A-Za-z0-9_-]{8,}/.test(readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8')))
})
