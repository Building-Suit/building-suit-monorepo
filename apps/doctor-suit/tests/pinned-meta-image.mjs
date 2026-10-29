// Both references identify the same immutable upstream release artifact.
// https://github.com/supabase/postgres-meta/blob/v0.98.0/.github/workflows/release.yml
export const doctorMetaDigest = 'sha256:cef71ba901751dcc242cc685cf13786935ea8926820fb342f23bb0fbef77de5a'
export const doctorMetaImages = Object.freeze([
  `ghcr.io/supabase/postgres-meta:v0.98.0@${doctorMetaDigest}`,
  `public.ecr.aws/supabase/postgres-meta:v0.98.0@${doctorMetaDigest}`,
])

export async function pullPinnedDoctorMetaImage(pull, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let image = doctorMetaImages[0]
  const attempts = []
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = pull(image)
    if (!result.error && result.status === 0) return image
    const diagnostic = String(result.stderr ?? '')
    // An authentication, permission or explicit policy denial never selects a mirror.
    const denied = /unauthorized|forbidden|access denied|permission denied|policy denied|\b40[13]\b/i.test(diagnostic)
    const transient = result.error?.code === 'ETIMEDOUT' || /toomanyrequests|rate exceeded|429|timed? ?out|502|503|temporary failure/i.test(diagnostic)
    const category = denied ? 'registry-access-denied' : result.error?.code === 'ETIMEDOUT' ? 'process-timeout' : /toomanyrequests|rate exceeded|429/i.test(diagnostic) ? 'registry-rate-limit' : transient ? 'registry-temporary' : /manifest unknown|not found/i.test(diagnostic) ? 'registry-not-found' : 'registry-other'
    attempts.push(`${attempt === 0 ? 'primary' : 'official-mirror'}:${category}`)
    if (attempt === 2 || denied || !transient) throw new Error('Pinned PostgreSQL Meta image unavailable; schema generation remains unverified; ' + attempts.join(','))
    image = doctorMetaImages[1]
    await pause([5000, 15000][attempt])
  }
}
