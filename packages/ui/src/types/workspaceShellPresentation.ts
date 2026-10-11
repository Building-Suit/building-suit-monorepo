import type { NotificationMenuItem, BsUsageItem } from '@building-suit/contracts'
import type { BsWorkspaceCreationView } from './workspaceCreationPresentation'
import type { BsWorkspaceOnboardingCopy } from './workspaceOnboardingCopy'
import type { BsFinancialSystemMapCopy } from './financialSystemMapCopy'
import type { BsJournalCreationFlow, BsJournalCreationView, BsJournalCreationCopy, BsJournalCreationOptions } from './journalCreationPresentation'
import type { BsOperationalCreationView, BsOperationalCreationCopy, BsOperationalCreationOptions } from './operationalCreationPresentation'
import type { BsAccessEditorState, BsAccessIdentityCopy } from './accessPresentation'
export interface BsShellNotifications { items: NotificationMenuItem[]; label: string; emptyLabel: string; markAllLabel: string; pending?: boolean }
export interface BsShellOnboarding { pending: boolean; error?: string | null; copy: BsWorkspaceOnboardingCopy; accounts: { code: string; name: string; debit: string; credit: string }[]; revision: string }
export interface BsShellFinancialMap { copy: BsFinancialSystemMapCopy; flows: string[]; checks: string[]; reports: string[] }
export interface BsShellJournalCreation { flow: BsJournalCreationFlow; view: BsJournalCreationView; copy: BsJournalCreationCopy; options: BsJournalCreationOptions }
export interface BsShellOperationalCreation { view: BsOperationalCreationView; copy: BsOperationalCreationCopy; options: BsOperationalCreationOptions }
export interface BsShellInvitation { state: BsAccessEditorState; copy: BsAccessIdentityCopy; roles: { value: string; label: string }[]; usage?: BsUsageItem }
export type BsShellWorkspaceCreation = BsWorkspaceCreationView
