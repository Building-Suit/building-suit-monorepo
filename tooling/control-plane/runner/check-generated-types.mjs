#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const file = process.argv[2]
if (!file) throw new Error('generated_types_file_required')
const result = spawnSync('pnpm', ['exec','supabase','gen','types','typescript','--local'], {encoding:'utf8',timeout:300000,maxBuffer:20*1024*1024})
if (result.status !== 0) {
 process.stderr.write(result.stderr ?? result.error?.message ?? 'local_type_generation_failed')
 process.exit(1)
}
const normalize = text => text.replace(/\r\n/g,'\n').trim()
if (normalize(result.stdout) !== normalize(readFileSync(file,'utf8'))) {
 process.stderr.write('Generated database types differ from the task artifact. Regenerate the checked artifact from the resulting local schema.\n')
 process.exit(1)
}
process.stdout.write('Generated types match the task artifact.\n')
