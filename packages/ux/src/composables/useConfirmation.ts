import type { ConfirmationRequest } from '../index'

export interface ConfirmationController {
  current: Readonly<Ref<ConfirmationRequest | null>>
  ask(request: ConfirmationRequest): Promise<boolean>
  ask(message: string, title?: string): Promise<boolean>
  answer(value: boolean): void
}

export function useConfirmation(): ConfirmationController { return useNuxtApp().$bsConfirm }
