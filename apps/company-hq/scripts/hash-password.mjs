import { randomBytes, scryptSync } from 'node:crypto'
let password = ''
for await (const chunk of process.stdin) password += chunk
password = password.replace(/\r?\n$/, '')
if (password.length < 12 || password.length > 512) throw new Error('Supply a 12–512 character password on stdin.')
const salt = randomBytes(16).toString('hex')
process.stdout.write(salt + ':' + scryptSync(password, salt, 64).toString('hex') + '\n')
