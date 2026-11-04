/** Presentation only; statuses and evidence are supplied by the authorized product projection. */
export interface LivingOfficeRoom { id: string; label: string; kind: 'executive' | 'department' }
export interface LivingOfficeEmployee {
  id: string
  name: string
  role: string
  departmentId: string
  status: 'idle' | 'queued' | 'working' | 'reviewing' | 'blocked'
  statusLabel: string
  description?: string
  reportsTo?: string
}
export interface LivingOfficeBrainActivity { id: string; direction: 'inbound' | 'outbound'; label: string; employeeId?: string }
export interface LivingOfficeSceneCopy {
  title: string; hint: string; fallback: string; loading: string
  zoomIn: string; zoomOut: string; reset: string; rotateLeft: string; rotateRight: string
  motion: string; pauseMotion: string; resumeMotion: string; directory: string; brain: string
  empty: string; departments: string; employees: string
}
