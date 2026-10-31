export const projectIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
export function validateProject(p) {
  if (!p || p.schemaVersion !== 1 || !projectIdPattern.test(p.id) || p.scene !== 'counter-to-tablet-v1') throw new Error('Unsupported project or scene')
  for (const [k, min, max] of [['duration',1,60],['fps',1,60],['width',64,2160],['height',64,3840],['revision',1,100000]]) if (!Number.isFinite(p[k]) || p[k] < min || p[k] > max) throw new Error(`Invalid ${k}`)
  if (![p.width,p.height,p.fps,p.revision].every(Number.isInteger)) throw new Error('Integer dimensions, fps and revision required')
  if (typeof p.name !== 'string' || typeof p.caption !== 'string' || p.caption.length > 160) throw new Error('Invalid copy')
  for (const key of ['receiptLift','cameraPush','goldIntensity']) if (!Number.isFinite(p.parameters?.[key]) || p.parameters[key] < 0.1 || p.parameters[key] > 2) throw new Error(`Invalid parameter ${key}`)
  if (!Array.isArray(p.assets) || p.assets.some(x => typeof x !== 'string' || !/^assets\/[a-zA-Z0-9_-]+\.svg$/.test(x))) throw new Error('Unsafe asset path')
  return p
}
export function frameTime(frame, project) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= Math.round(project.duration * project.fps)) throw new Error('Frame outside project')
  return frame / project.fps
}
