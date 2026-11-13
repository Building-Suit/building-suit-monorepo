/** Keep private receipt navigation on the configured browser-facing project. */
export function platformReceiptUrl(value: unknown, projectUrl: string): string {
  if (typeof value !== 'string') throw new Error('RECEIPT_URL_INVALID')
  const project = new URL(projectUrl)
  const signed = new URL(value, project)
  const prefix = '/storage/v1/object/sign/manual-payment-receipts/'
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(project.hostname)
  if ((project.protocol !== 'https:' && !(project.protocol === 'http:' && local))
    || project.username || project.password || project.pathname !== '/' || project.search || project.hash
    || !['https:', 'http:'].includes(signed.protocol) || signed.username || signed.password || signed.hash
    || !signed.pathname.startsWith(prefix) || signed.pathname.length <= prefix.length
    || !signed.searchParams.get('token')) throw new Error('RECEIPT_URL_INVALID')
  // The Edge SDK can sign through an internal gateway. Its host is never a
  // navigation destination; Storage verifies the signed path/token on our project.
  return new URL(signed.pathname + signed.search, project.origin).href
}
