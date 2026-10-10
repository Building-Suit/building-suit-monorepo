const BUCKET = 'shop-payment-evidence'

function trustedOrigin(value) {
  // Reject URL-parser normalization of credentials, paths, whitespace and backslashes.
  if (typeof value !== 'string' || !/^https?:\/\/[^\s\\/?#@%]+\/?$/i.test(value)) {
    throw new Error('payment_evidence_signing_invalid')
  }
  let url
  try { url = new URL(value) } catch { throw new Error('payment_evidence_signing_invalid') }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || value.replace(/\/$/, '').endsWith(':')) {
    throw new Error('payment_evidence_signing_invalid')
  }
  return url.origin
}

function encodeObjectName(name) {
  if (typeof name !== 'string' || !name || name.startsWith('/') || name.includes('..')) {
    throw new Error('payment_evidence_signing_invalid')
  }
  return name.split('/').map(encodeURIComponent).join('/')
}

export async function signPaymentEvidenceAccess({
  data, supabaseUrl, publicSupabaseUrl = supabaseUrl, serviceRoleKey, fetchImpl = fetch,
}) {
  if (!data || data.bucket !== BUCKET
    || !Number.isInteger(data.expiresIn) || data.expiresIn < 30 || data.expiresIn > 300
    || typeof serviceRoleKey !== 'string' || !serviceRoleKey) {
    throw new Error('payment_evidence_signing_invalid')
  }
  const signingOrigin = trustedOrigin(supabaseUrl)
  const publicOrigin = trustedOrigin(publicSupabaseUrl)
  const objectName = encodeObjectName(data.objectName)
  const storagePath = `/object/sign/${BUCKET}/${objectName}`
  const publicPath = `/storage/v1${storagePath}`
  const response = await fetchImpl(
    `${signingOrigin}${publicPath}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ expiresIn: data.expiresIn }),
    },
  )
  const payload = await response.json().catch(() => null)
  const signedPath = payload?.signedURL ?? payload?.signedUrl
  const queryIndex = typeof signedPath === 'string' ? signedPath.indexOf('?') : -1
  const path = queryIndex < 0 ? '' : signedPath.slice(0, queryIndex)
  const query = queryIndex < 0 ? '' : signedPath.slice(queryIndex)
  // Compare raw paths before parsing: URL normalization must not hide traversal
  // or substitute another object. Storage returns its relative /object/sign path.
  if (!response.ok || (path !== storagePath && path !== publicPath)
    || !/^\?token=[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(query)) {
    throw new Error('payment_evidence_signing_failed')
  }
  const { bucket: _bucket, objectName: _objectName, expiresIn: _expiresIn, ...metadata } = data
  return { ...metadata, signedUrl: `${publicOrigin}${publicPath}${query}` }
}

export function isPaymentEvidenceAccess(envelope) {
  return envelope?.operation === 'shop.billing.query'
    && envelope?.payload?.resource === 'evidence'
}
