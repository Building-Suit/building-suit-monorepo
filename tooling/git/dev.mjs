import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { applications, explicitWorktrees, inspectWorktrees, selectWorktree } from './dev-worktrees.mjs'

const exists = file => access(file).then(() => true, () => false)
const [name, ...args] = process.argv.slice(2)
try {
  const app = applications[name]
  if (!app) throw new Error('Usage: pnpm dev:<ledger|shop|docs|inventory> [--list|--dry-run] [--current|--worktree <branch/path>] [Nuxt options]')
  let currentOnly = false, worktree, dryRun = false
  const forwarded = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') continue
    if (args[i] === '--current') currentOnly = true
    else if (['--list', '--dry-run'].includes(args[i])) dryRun = true
    else if (args[i] === '--worktree') {
      worktree = args[++i]
      if (!worktree || worktree.startsWith('-')) throw new Error('--worktree requires a branch name or path.')
    }
    else forwarded.push(args[i])
  }
  if (!currentOnly && !worktree) console.log(`[dev:${name}] Checking worktrees and live GitHub PR state…`)
  const snapshot = currentOnly || worktree ? await explicitWorktrees(process.cwd()) : await inspectWorktrees(process.cwd(), app)
  const selected = selectWorktree(snapshot.trees, snapshot.current, { currentOnly, worktree })
  if (!selected) throw new Error('Current checkout is not a registered worktree.')
  const directory = join(selected.path, 'apps', app.directory)
  if (!await exists(join(directory, 'package.json'))) throw new Error(`The selected checkout has no apps/${app.directory}.`)
  const fallback = !currentOnly && !worktree && !(selected.active && selected.relevant)
  console.log(`[dev:${name}] ${fallback ? 'Original checkout (no active app worktree)' : 'Selected worktree'}: ${selected.path}`)
  console.log(`[dev:${name}] Branch: ${selected.branch ?? '(detached)'} | ${selected.head.slice(0, 10)}${selected.dirty ? ` | ${selected.dirty} relevant uncommitted files` : ''}`)
  console.log(`[dev:${name}] Selection is fixed for this process; restart to select newer work.`)
  if (dryRun) for (const tree of snapshot.trees) console.log(`  ${tree.path === selected.path ? '*' : '-'} ${tree.branch ?? '(detached)'}: ${tree.reason ?? 'explicit selection'} (${tree.path})`)
  const options = [...forwarded]
  if (!options.some(arg => arg === '--port' || arg.startsWith('--port=') || arg === '-p')) options.unshift('--port', String(app.port))
  if (!options.some(arg => arg === '--dotenv' || arg.startsWith('--dotenv='))) {
    const local = join(directory, '.env')
    const original = join(snapshot.trees[0].path, 'apps', app.directory, '.env')
    if (await exists(local)) console.log(`[dev:${name}] Local environment file: ${local}`)
    else if (await exists(original)) {
      options.push('--dotenv', original)
      console.log(`[dev:${name}] Local environment file from original checkout: ${original}`)
    }
  }
  const command = ['--dir', selected.path, '--filter', app.package, 'dev', ...options]
  if (dryRun) { console.log(`pnpm arguments: ${JSON.stringify(command)}`) }
  else {
    if (!await exists(join(selected.path, 'node_modules', '.modules.yaml'))) throw new Error(`Dependencies missing in ${selected.path}. Run pnpm install --frozen-lockfile and pnpm run setup there, then retry.`)
    const grouped = process.platform !== 'win32'
    const child = spawn('pnpm', command, { cwd: selected.path, stdio: 'inherit', detached: grouped })
    // pnpm may not forward termination to Nuxt. Stop the whole launched process group.
    const stop = signal => {
      if (!child.pid) return
      try { if (grouped) process.kill(-child.pid, signal); else child.kill(signal) }
      catch (error) { if (error.code !== 'ESRCH') console.error('Could not stop the dev process group.') }
    }
    const interrupt = () => stop('SIGINT')
    const terminate = () => stop('SIGTERM')
    process.on('SIGINT', interrupt)
    process.on('SIGTERM', terminate)
    child.on('error', () => { console.error('Could not start pnpm in the selected worktree.'); process.exitCode = 1 })
    child.on('close', (code, signal) => {
      process.removeListener('SIGINT', interrupt)
      process.removeListener('SIGTERM', terminate)
      process.exitCode = code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1)
    })
  }
}
catch (error) {
  console.error(error instanceof Error && !('cmd' in error) ? error.message : 'Worktree inspection failed; check Git access and use --current or --worktree for explicit selection.')
  process.exitCode = 1
}
