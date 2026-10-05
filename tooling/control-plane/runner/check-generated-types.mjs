#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
const file = process.argv[2]
const expectedFile = process.argv[3] ?? path.join(process.cwd(), '.local', 'control-plane-verification', 'generated-types.expected.ts')
if (!file) throw new Error('generated_types_file_required')
const result = spawnSync('pnpm', ['exec','supabase','gen','types','typescript','--local'], {encoding:'utf8',timeout:300000,maxBuffer:20*1024*1024})
if (result.status !== 0) {
 process.stderr.write(result.stderr ?? result.error?.message ?? 'local_type_generation_failed')
 process.exit(1)
}
mkdirSync(path.dirname(expectedFile), {recursive:true})
writeFileSync(expectedFile, result.stdout, { mode: 0o600 })
const normalize = text => text.replace(/\r\n/g,'\n').trim()
if (normalize(result.stdout) !== normalize(readFileSync(file,'utf8'))) {
 process.stderr.write('Generated database types differ from the task artifact. Regenerate the checked artifact from the resulting local schema.\n' + (expectedFile ? `Generated schema artifact for repair: ${expectedFile}\n` : ''))
 process.exit(1)
}
process.stdout.write('Generated types match the task artifact.\n')
