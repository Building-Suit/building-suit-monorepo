import { spawn } from 'node:child_process'
const child = spawn(process.execPath, ['.output/server/index.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, HOST: '127.0.0.1', PORT: '4337' },
})
let stopped=false
function stop() { if(stopped)return;stopped=true;child.kill('SIGTERM') }
process.on('SIGTERM',stop);process.on('SIGINT',stop)
child.on('exit', code => process.exit(code ?? 0))
