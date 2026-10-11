import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = new URL('../../../', import.meta.url)
const matrix = JSON.parse(readFileSync(new URL('launch-qualification.json', import.meta.url)))
// Structured argv only; no shell, hosted target, deployment or provider API.
export function assertLocalCommands(commands) {
  for (const command of commands) {
    if (!['node', 'pnpm', 'git'].includes(command.program)
      || command.args.some(arg => /^(push|deploy|link|reset|--linked|--project-ref|--db-url)$/.test(arg))
      || command.args.some(arg => /https:\/\//.test(arg))
      || (command.args.includes('supabase') && !command.args.includes('--local'))) {
      throw new Error(`Non-local qualification command: ${command.name}`)
    }
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const mode = process.argv.slice(2)
  if (mode.length !== 1 || !['--list', '--run'].includes(mode[0])) {
    console.error('Usage: node apps/shop-suit/tests/run-launch-qualification.mjs --list|--run')
    process.exit(2)
  }
  assertLocalCommands(matrix.commands)
  if (mode[0] === '--list') {
    console.log(JSON.stringify(matrix.commands, null, 2))
  } else {
    const results = []
    const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(root), encoding: 'utf8' })
    if (revision.status !== 0) throw new Error('Cannot bind evidence to source revision')
    for (const command of matrix.commands) {
      console.log(`Running ${command.name}`)
      const started = Date.now()
      const result = spawnSync(command.program, command.args, {
        cwd: fileURLToPath(new URL(command.cwd ? `${command.cwd}/` : '.', root)),
        stdio: 'inherit', timeout: 1800000,
      })
      results.push({
        name: command.name, cwd: command.cwd ?? '.',
        program: command.program, args: command.args,
        exit_code: result.status,
        status: result.error?.code === 'ETIMEDOUT' ? 'timed_out' : result.status === 0 ? 'passed' : 'failed',
        duration_seconds: (Date.now() - started) / 1000,
      })
      writeFileSync(new URL('apps/shop-suit/docs/SS-VAL-001-results.json', root), `${JSON.stringify({
        task: matrix.task, date: new Date().toISOString(), source_revision: revision.stdout.trim(),
        evidence_kind: 'local execution; not independent/provider/deployment evidence', results,
      }, null, 2)}\n`)
    }
    process.exitCode = results.every(result => result.status === 'passed') ? 0 : 1
  }
}
