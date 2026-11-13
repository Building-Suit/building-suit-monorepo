// Only fixed categories, a bounded engine major and booleans leave private
// emulator output. Never retain exception bodies, URLs, DOM text or identities.
export function androidRuntimeDiagnostics(provider, clientLog, hierarchy) {
  const major = typeof provider === 'string'
    ? /Current WebView package \(name, version\): \([^,\n]+, ([1-9][0-9]{0,2})\./.exec(provider)?.[1] : undefined
  const log = typeof clientLog === 'string' ? clientLog : ''
  const clientIssues = [
    [/SyntaxError/, 'client-syntax-error'],
    [/TypeError/, 'client-type-error'],
    [/Content Security Policy|Refused to (?:load|execute|connect)/i, 'client-content-policy'],
    [/ERR_FILE_NOT_FOUND/, 'client-asset-missing'],
    [/FATAL EXCEPTION[\s\S]*com\.buildingsuit\.doctor\.synthetic/, 'native-crash'],
  ].filter(([pattern]) => pattern.test(log)).map(([, category]) => category)
  const xml = typeof hierarchy === 'string' ? hierarchy : ''
  return {webviewMajor: major ? Number(major) : null, clientIssues,
    webviewVisible: xml.includes('android.webkit.WebView'),
    syntheticPackageVisible: xml.includes('package="com.buildingsuit.doctor.synthetic"')}
}
