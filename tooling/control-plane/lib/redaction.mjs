const sensitiveKey = /(password|passwd|secret|token|api[_-]?key|authorization|cookie|private[_-]?key|database_url)/i
const credentialPatterns = [
  /\b(?:sk|pk)_[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[opusr]_[A-Za-z0-9_]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /postgres(?:ql)?:\/\/[^\s@]+@/gi,
]

export function redactText(value) {
  let text = String(value ?? '')
  for (const pattern of credentialPatterns) text = text.replace(pattern, '[REDACTED]')
  return text
}

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : redact(item),
    ]))
  }
  return typeof value === 'string' ? redactText(value) : value
}
