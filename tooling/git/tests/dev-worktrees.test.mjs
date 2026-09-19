import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, writeFile, rm, utimes, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { applications, inspectWorktrees, selectWorktree } from '../dev-worktrees.mjs'

const launcher = fileURLToPath(new URL('../dev.mjs', import.meta.url))
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'bs dev worktrees '))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const root = join(folder, 'original checkout')
  await mkdir(root)
  git(root, 'init', '-b', 'main')
  git(root, 'config', 'user.name', 'Fixture')
  git(root, 'config', 'user.email', 'fixture@example.test')
  for (const app of Object.values(applications)) {
    const dir = join(root, 'apps', app.directory)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: app.package }))
    await writeFile(join(dir, 'page.vue'), 'baseline')
  }
  await writeFile(join(root, '.gitignore'), 'node_modules/\n.env\n')
  git(root, 'add', '.')
  git(root, 'commit', '-m', 'baseline')
  git(root, 'update-ref', 'refs/remotes/origin/stg', 'HEAD')
  const tree = (name, parent = 'main') => {
    const path = join(folder, name)
    git(root, 'worktree', 'add', '-b', `codex/${name.replaceAll(" ", "-")}`, path, parent)
    return path
  }
  const inspect = app => inspectWorktrees(root, applications[app], { refresh: false, lookupPr: async () => null })
  return { folder, root, tree, inspect }
}

test('no active app worktree falls back to the original checkout, including when called from another worktree', async t => {
  const f = await fixture(t)
  const original = await inspectWorktrees(f.root, applications.ledger)
  assert.equal(selectWorktree(original.trees, f.root).path, f.root)
  const child = f.tree('empty')
  const snapshot = await f.inspect('ledger')
  assert.equal(selectWorktree(snapshot.trees, child).path, f.root)
  assert.equal(selectWorktree(snapshot.trees, child, { currentOnly: true }).path, child)
})

test('app-specific selection sees unstaged and untracked edits without modifying them or sharing another app branch', async t => {
  const f = await fixture(t)
  const ledger = f.tree('ledger')
  const shop = f.tree('shop')
  await writeFile(join(ledger, 'apps/ledger-suit/new.vue'), 'unsaved feature')
  await writeFile(join(shop, 'apps/shop-suit/page.vue'), 'shop feature')
  const before = git(ledger, 'status', '--porcelain')
  assert.equal(selectWorktree((await f.inspect('ledger')).trees, f.root).path, ledger)
  assert.equal(selectWorktree((await f.inspect('shop')).trees, f.root).path, shop)
  assert.equal(git(ledger, 'status', '--porcelain'), before)
})

test('merged or closed PRs are excluded even with newer dirty files; detached checkouts are excluded', async t => {
  const f = await fixture(t)
  const retired = f.tree('retired')
  const active = f.tree('active')
  const detached = f.tree('detached')
  for (const path of [retired, active, detached]) await writeFile(join(path, 'apps/ledger-suit/page.vue'), 'feature')
  git(detached, 'switch', '--detach')
  for (const merged_at of [null, '2026-09-19']) {
    const snapshot = await inspectWorktrees(f.root, applications.ledger, { refresh: false, lookupPr: async branch => branch === 'codex/retired' ? { state: 'closed', merged_at } : null })
    assert.equal(selectWorktree(snapshot.trees, f.root).path, active)
  }
})

test('stack descendants win equal source activity, but later uncommitted parent edits remain visible', async t => {
  const f = await fixture(t)
  const parent = f.tree('parent')
  await writeFile(join(parent, 'apps/ledger-suit/page.vue'), 'committed parent')
  git(parent, 'add', '.'); git(parent, 'commit', '-m', 'parent feature')
  const child = f.tree('child', 'codex/parent')
  await writeFile(join(child, 'tooling-note.md'), 'child tooling only')
  git(child, 'add', '.'); git(child, 'commit', '-m', 'child tooling')
  assert.equal(selectWorktree((await f.inspect('ledger')).trees, f.root).path, child)
  const source = join(parent, 'apps/ledger-suit/page.vue')
  await writeFile(source, 'new uncommitted parent work')
  const later = new Date(Date.now() + 5000)
  await utimes(source, later, later)
  assert.equal(selectWorktree((await f.inspect('ledger')).trees, f.root).path, parent)
})

test('shared changes reach all apps and deleted source files are counted', async t => {
  const f = await fixture(t)
  const shared = f.tree('shared')
  await mkdir(join(shared, 'packages/ui'), { recursive: true })
  await writeFile(join(shared, 'packages/ui/theme.css'), 'shared')
  for (const app of ['ledger', 'shop', 'docs']) assert.equal(selectWorktree((await f.inspect(app)).trees, f.root).path, shared)
  await rm(join(shared, 'packages'), { recursive: true })
  await rm(join(shared, 'apps/ledger-suit/page.vue'))
  assert.equal(selectWorktree((await f.inspect('ledger')).trees, f.root).path, shared)
})

test('explicit branch/path selection works offline; invalid or conflicting selections fail', async t => {
  const f = await fixture(t)
  const child = f.tree('space in path')
  const snapshot = await f.inspect('ledger')
  assert.equal(selectWorktree(snapshot.trees, f.root, { worktree: child }).path, child)
  assert.throws(() => selectWorktree(snapshot.trees, f.root, { worktree: 'missing' }), /registered/)
  assert.throws(() => selectWorktree(snapshot.trees, f.root, { currentOnly: true, worktree: child }), /either/)
  const output = execFileSync(process.execPath, [launcher, 'ledger', '--worktree', child, '--dry-run'], { cwd: f.root, encoding: 'utf8' })
  assert.ok(output.includes(child))
  assert.throws(() => execFileSync(process.execPath, [launcher, 'ledger', '--worktree'], { cwd: f.root, stdio: 'pipe' }))
  await assert.rejects(inspectWorktrees(f.root, applications.ledger), /Could not refresh/)
})

test('launcher invokes the chosen app in its own workspace, forwards flags, and reuses only the original local dotenv', async t => {
  const f = await fixture(t)
  const child = f.tree('launch')
  const bin = join(f.folder, 'bin'), capture = join(f.folder, 'spawn.json')
  await mkdir(bin)
  await mkdir(join(child, 'node_modules'))
  await writeFile(join(child, 'node_modules/.modules.yaml'), '')
  await writeFile(join(f.root, 'apps/ledger-suit/.env'), 'NOT_PRINTED=local-only\n')
  await writeFile(join(f.root, 'apps/ledger-suit/.env.production'), 'NOT_PRINTED=never-load\n')
  await writeFile(join(bin, 'pnpm'), `#!/usr/bin/env node\nrequire('fs').writeFileSync(process.env.CAPTURE, JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)}))\n`, { mode: 0o755 })
  const output = execFileSync(process.execPath, [launcher, 'ledger', '--worktree', child, '--port', '3999', '--host', '127.0.0.1'], { cwd: f.root, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CAPTURE: capture } })
  const launched = JSON.parse(await readFile(capture, 'utf8'))
  assert.equal(resolve(launched.cwd), resolve(child))
  assert.deepEqual(launched.args, ['--dir', child, '--filter', '@building-suit/ledger-suit', 'dev', '--port', '3999', '--host', '127.0.0.1', '--dotenv', join(f.root, 'apps/ledger-suit/.env')])
  assert.doesNotMatch(output, /local-only|never-load/)
})
