import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scryptSync, createHash } from 'node:crypto'
const dir = mkdtempSync(join(tmpdir(),'hq-browser-'))
const salt = 'a'.repeat(32), password = 'synthetic-browser-password'
const hash = value => createHash('sha256').update(value).digest('hex')
// Synthetic test credentials only; never used by the ordinary runtime.
const child = spawn(process.execPath,['.output/server/index.mjs'], { stdio: 'inherit', env: { ...process.env, HOST:'127.0.0.1', PORT:'4337', HQ_APP_ORIGIN:'http://127.0.0.1:4337', HQ_DATA_PATH:join(dir,'hq.sqlite'), HQ_FOUNDER_PASSWORD_HASH:salt+':'+scryptSync(password,salt,64).toString('hex'), HQ_CEO_TOKEN_SHA256:hash('synthetic-ceo-token-'.repeat(3)), HQ_HR_TOKEN_SHA256:hash('synthetic-hr-token-'.repeat(3)) } })
let stopped=false
function stop() { if(stopped)return;stopped=true;child.kill('SIGTERM') }
process.on('SIGTERM',stop);process.on('SIGINT',stop)
child.on('exit',code=>{rmSync(dir,{recursive:true,force:true});process.exit(code??0)})
