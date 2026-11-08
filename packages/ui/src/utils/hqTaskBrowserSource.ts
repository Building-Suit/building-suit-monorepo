import { inject, provide, type InjectionKey } from 'vue'
import type { HqTaskBrowserPage, HqTaskBrowserRequest, HqTaskPresentation } from '../types/hqAgentsPresentation'

export interface HqTaskBrowserSource {
  load(request: HqTaskBrowserRequest, signal: AbortSignal): Promise<HqTaskBrowserPage>
  detail(id: string, signal: AbortSignal): Promise<HqTaskPresentation | null>
}

const taskBrowserSource: InjectionKey<HqTaskBrowserSource> = Symbol('HQ task browser source')

export function provideHqTaskBrowserSource(source: HqTaskBrowserSource) {
  provide(taskBrowserSource, source)
}

export function useHqTaskBrowserSource() {
  return inject(taskBrowserSource, null)
}
