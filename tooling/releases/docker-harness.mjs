import { spawnSync } from 'node:child_process'

export function dockerFailureReason(stderr = '') {
  for (const [pattern, reason] of [
    [/no space left|disk quota exceeded/i, 'DOCKER_STORAGE_EXHAUSTED'],
    [/toomanyrequests|rate limit/i, 'DOCKER_REGISTRY_RATE_LIMIT'],
    [/pull access denied|authorization token|unauthorized|denied:/i, 'DOCKER_IMAGE_ACCESS_DENIED'],
    [/manifest unknown|not found.*manifest/i, 'DOCKER_IMAGE_NOT_FOUND'],
    [/port is already allocated|address already in use/i, 'DOCKER_PORT_UNAVAILABLE'],
    [/cannot connect.*docker|docker daemon.*not running/i, 'DOCKER_DAEMON_UNAVAILABLE'],
    [/container name.*already in use/i, 'DOCKER_CONTAINER_NAME_CONFLICT'],
  ]) if (pattern.test(stderr)) return reason
  return 'DOCKER_START_FAILED'
}
export function ensureDisposableImage(image, mirror, run = spawnSync) {
  const invoke=args=>run('docker',args,{encoding:'utf8',timeout:120000})
  if(invoke(['image','inspect',image]).status===0) return
  const primary=invoke(['pull',image])
  if(primary.status===0) return
  const reason=dockerFailureReason(primary.stderr)
  if(mirror && ['DOCKER_REGISTRY_RATE_LIMIT','DOCKER_IMAGE_ACCESS_DENIED','DOCKER_IMAGE_NOT_FOUND'].includes(reason)) {
    if(invoke(['pull',mirror]).status===0 && invoke(['tag',mirror,image]).status===0) return
  }
  throw new Error(`Disposable image unavailable: ${reason}; raw output omitted`)
}
