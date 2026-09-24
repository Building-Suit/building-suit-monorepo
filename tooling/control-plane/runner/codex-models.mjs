#!/usr/bin/env node

import { spawn } from 'node:child_process'
import readline from 'node:readline'

const timeoutMs = 15_000

const child = spawn(
  'codex',
  [
    'app-server',
    '--stdio',
  ],
  {
    env: process.env,
    stdio: [
      'pipe',
      'pipe',
      'pipe',
    ],
  },
)

let stderr = ''
let finished = false

const timer = setTimeout(() => {
  finish(
    1,
    null,
    `Timed out waiting for Codex model/list after ${timeoutMs}ms.`,
  )
}, timeoutMs)

child.stderr.setEncoding('utf8')

child.stderr.on('data', chunk => {
  stderr += chunk

  if (stderr.length > 8000) {
    stderr = stderr.slice(-8000)
  }
})

const lines = readline.createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
})

function send(payload) {
  child.stdin.write(
    `${JSON.stringify(payload)}\n`,
  )
}

function finish(
  code,
  payload = null,
  errorMessage = null,
) {
  if (finished) {
    return
  }

  finished = true
  clearTimeout(timer)

  if (payload !== null) {
    process.stdout.write(
      `${JSON.stringify(payload)}\n`,
    )
  }

  if (errorMessage) {
    process.stderr.write(
      `${errorMessage}\n`,
    )
  }

  if (stderr.trim()) {
    process.stderr.write(stderr)
  }

  lines.close()

  if (!child.stdin.destroyed) {
    child.stdin.end()
  }

  child.kill('SIGTERM')

  const killTimer = setTimeout(() => {
    if (!child.killed) {
      child.kill('SIGKILL')
    }
  }, 1000)

  killTimer.unref()

  child.once('close', () => {
    process.exit(code)
  })

  const forceExit = setTimeout(() => {
    process.exit(code)
  }, 1500)

  forceExit.unref()
}

lines.on('line', line => {
  let message

  try {
    message = JSON.parse(line)
  }
  catch {
    return
  }

  // Wait for the initialize response before requesting
  // the catalog. This mirrors a real app-server client.
  if (message.id === 1) {
    if (message.error) {
      finish(
        1,
        null,
        `Codex initialize failed: ${
          message.error.message ??
          JSON.stringify(message.error)
        }`,
      )

      return
    }

    send({
      jsonrpc: '2.0',
      method: 'initialized',
    })

    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'model/list',
      params: {
        limit: 100,
        includeHidden: false,
      },
    })

    return
  }

  if (message.id === 2) {
    if (message.error) {
      finish(
        1,
        null,
        `Codex model/list failed: ${
          message.error.message ??
          JSON.stringify(message.error)
        }`,
      )

      return
    }

    const models = message.result?.data

    if (
      !Array.isArray(models) ||
      models.length === 0
    ) {
      finish(
        1,
        null,
        'Codex model/list returned an empty catalog.',
      )

      return
    }

    finish(
      0,
      models,
    )
  }
})

child.on('error', error => {
  finish(
    1,
    null,
    `Unable to start Codex app-server: ${error.message}`,
  )
})

child.on('close', code => {
  if (!finished) {
    finish(
      1,
      null,
      `Codex app-server exited before model/list completed (code ${code}).`,
    )
  }
})

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    clientInfo: {
      name: 'building-suit-control-plane',
      title: 'Building Suit Control Plane',
      version: '0.1.0',
    },
    capabilities: {
      experimentalApi: true,
    },
  },
})
