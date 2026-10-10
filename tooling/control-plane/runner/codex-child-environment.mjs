// Host verifier/database/publication credentials never enter model processes.
const ALLOWED = Object.freeze(['PATH','HOME','TMPDIR','LANG','LC_ALL','LC_CTYPE','TZ','TERM','COLORTERM',
  'USER','LOGNAME','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'])
export function codexChildEnvironment(parent, {codexHome} = {}) {
  const child = Object.fromEntries(ALLOWED.filter(key=>typeof parent[key]==='string').map(key=>[key,parent[key]]))
  if (typeof codexHome !== 'string' || !codexHome.startsWith('/')) throw new Error('explicit_codex_auth_home_required')
  child.CODEX_HOME=codexHome
  return child
}
