export interface BsProjectRegistryView {
  id: string
  name: string
  subtitle: string
  status: string
  statusLabel: string
  statusTone: 'neutral' | 'success' | 'info' | 'warning' | 'danger'
  branchSummary: string
  policySummary: string
  configuration: string
  workstreams: { id: string; name: string; subtitle: string; application: string; status: string; statusLabel: string; statusTone: 'neutral' | 'success' | 'info' | 'warning' | 'danger' }[]
}
export interface BsProjectRegistrationForm {
  name: string
  slug: string
  repositoryPath: string
  repository: string
  integrationBranch: string
  productionBranch: string
  localRoot: string
  worktreeRoot: string
  retryPolicy: string
  modelProfile: string
  workstreams: string
  publicationPaths: string
  verificationCommands: string
  active: boolean
}
export interface BsProjectRegistryCopy {
  eyebrow: string
  title: string
  description: string
  register: string
  refresh: string
  configuration: string
  editorTitle: string
  editorDescription: string
  submit: string
  validate: string
  activate: string
  writeStatus: string
  fields: { [K in keyof Omit<BsProjectRegistrationForm, 'active'>]: string }
}
