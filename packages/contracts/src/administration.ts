/** Data-only administration extension. Descriptors describe support, never authority. */
export interface BsSuitIdentity {
  id: string
  label: string
  icon?: string
  logo?: string
  disabled?: boolean
}
export interface BsAdministrationCapabilityReference {
  kind: 'read' | 'command'
  id: string
  version: number
}
export interface BsAdministrationNavigationItem {
  id: string
  label: string
  icon?: string
  to?: string
  disabled?: boolean
  /** Every dependency must have an enabled adapter at this exact version. */
  requires?: readonly BsAdministrationCapabilityReference[]
  unsupported?: 'hide' | 'disable'
}
export interface BsAdministrationNavigationGroup {
  id: string
  label: string
  items: readonly BsAdministrationNavigationItem[]
}
export interface BsAdministrationOperation<Input = unknown, Output = unknown> {
  version: number
  input: Input
  output: Output
}
export type BsAdministrationOperations = Record<string, BsAdministrationOperation>
export interface BsAdministrationCapabilityDescriptor {
  version: number
  label: string
  enabled?: boolean
}
export interface BsAdministrationRequestContext {
  /** Product/environment identity is explicit; no shared sessions are implied. */
  environment: string
  portal: string
  userId: string
  tenantId: string
  signal: AbortSignal
}
export type BsAdministrationDescriptors<Operations extends BsAdministrationOperations> = {
  readonly [Key in keyof Operations]?: BsAdministrationCapabilityDescriptor & { version: Operations[Key]['version'] }
}
export type BsAdministrationAdapters<Operations extends BsAdministrationOperations> = {
  readonly [Key in keyof Operations]?: {
    version: Operations[Key]['version']
    execute(input: Operations[Key]['input'], context: Readonly<BsAdministrationRequestContext>): Promise<Operations[Key]['output']>
  }
}
export interface BsSuitAdministrationRegistration<
  Reads extends BsAdministrationOperations = BsAdministrationOperations,
  Commands extends BsAdministrationOperations = BsAdministrationOperations,
> {
  contractVersion: 1
  identity: BsSuitIdentity
  navigation: readonly BsAdministrationNavigationGroup[]
  capabilities: {
    read: BsAdministrationDescriptors<Reads>
    command: BsAdministrationDescriptors<Commands>
  }
  adapters: {
    read: BsAdministrationAdapters<Reads>
    command: BsAdministrationAdapters<Commands>
  }
}
