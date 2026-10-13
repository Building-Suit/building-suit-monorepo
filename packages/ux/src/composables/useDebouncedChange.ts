import { useDebouncedTask } from './useDebouncedTask.ts'
import { onScopeDispose, watch, type WatchSource } from 'vue'

/** Coalesces interaction changes, cancelling pending work when the view is disposed. */
export function useDebouncedChange<T>(source: WatchSource<T>, commit: (value: T) => void, delay = 300) {
  const task = useDebouncedTask(commit, delay)
  const stop = watch(source, task.schedule)
  onScopeDispose(stop)
  return { cancel: task.cancel }
}
