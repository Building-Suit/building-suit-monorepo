import { parseChangelogFeed, filterChangelog } from '@building-suit/contracts'
import type { ChangelogFeed, ChangelogFilter } from '@building-suit/contracts'
/** Inject a product-owned authorized transport. No credentials, endpoint or shared cache. */
export function createChangelogClient(read: (signal?: AbortSignal) => Promise<unknown>) {
  return { async list(filter: ChangelogFilter = {}, signal?: AbortSignal): Promise<ChangelogFeed> {
    const feed = parseChangelogFeed(await read(signal))
    signal?.throwIfAborted()
    return { ...feed, entries: filterChangelog(feed, filter) }
  } }
}
