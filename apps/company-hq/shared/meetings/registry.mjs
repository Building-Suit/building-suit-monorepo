/** Parse only the maintained roster table; prose is never executable authority. */
export function parseMeetingRegistry(markdown, source) {
  if (typeof markdown !== 'string' || markdown.length > 256_000 || !source?.id || !source?.version) throw new Error('Registry unavailable')
  const ids = new Set()
  const rows = []
  for (const line of markdown.split('\n')) {
    // Wiki-link aliases contain pipes which are not table separators.
    const cells = line.replace(/\[\[([^\]]+)\]\]/g, (_match, value) => value.replaceAll('|', ' / ')).split('|').slice(1, -1).map(cell => cell.trim())
    if (!/^AG-[A-Z]+-\d{3}$/.test(cells[0] ?? '')) continue
    if (cells.length !== 6 || ids.has(cells[0])) throw new Error('Ambiguous registry')
    const identity = /^(.+?)\s+[—–]\s+(.+?)\s+\/\s+(.+)$/.exec(cells[1])
    if (!identity || cells.some(cell => cell.length > 4_000)) throw new Error('Invalid registry row')
    ids.add(cells[0])
    rows.push({ id: cells[0], name: identity[1], role: identity[2], supervisorName: identity[3].replace(/\s*\(.+\)$/, ''), lifecycle: cells[3], operation: cells[4], source: { ...source }, qualifiedForLiveMeeting: false })
  }
  if (rows.length < 1 || rows.length > 32 || !rows.some(row => row.id === 'AG-CEO-001')) throw new Error('Registry unavailable')
  return rows
}

/** Dated canonical identities for the isolated fixture, never a live roster. */
export const demonstrationRegistry = [
  ['AG-CEO-001', 'Steve', 'CEO', 'Founder'], ['AG-HR-001', 'Amaya', 'HR Lead', 'Steve'],
  ['AG-HR-002', 'Noah', 'Recruiter', 'Amaya'], ['AG-HR-003', 'Iris', 'Evaluator', 'Amaya'],
  ['AG-RES-001', 'Nadia', 'Research Lead', 'Steve'], ['AG-SALES-001', 'Omar', 'Acquisition and Partnerships', 'Steve'],
  ['AG-CS-001', 'Salma', 'Customer Success', 'Steve'], ['AG-SOC-001', 'Layla', 'Social and Community', 'Steve'],
  ['AG-EMAIL-001', 'Youssef', 'Email and Lifecycle', 'Steve'], ['AG-DEV-001', 'Adam', 'Maintenance', 'Steve'],
].map(([id, name, role, supervisorName]) => ({ id, name, role, supervisorName, lifecycle: 'Configured; live qualification unverified', operation: 'Synthetic fixture only', qualifiedForLiveMeeting: false, source: { id: '1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N', version: '2026-11-04T22:31:45.550Z', url: 'https://drive.google.com/file/d/1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N/view' } }))
