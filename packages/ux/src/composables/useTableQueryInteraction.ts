import { ref, watch } from 'vue'
import type { BsDataTableQueryAdapter, BsDataTablePageQuery, BsDataTableSortQuery, BsDataTableFilterQuery } from '../index.ts'

/** Dispatches table interaction intent to the product-owned query adapter. */
export function useTableQueryInteraction<P extends BsDataTablePageQuery, S extends BsDataTableSortQuery, F extends BsDataTableFilterQuery>(
  adapter: () => BsDataTableQueryAdapter | undefined,
  events: { search: (value: string) => void; page: (event: P) => void; sort: (event: S) => void; filter: (event: F) => void },
) {
  const search = ref('')
  watch(search, value => { adapter()?.search?.(value); events.search(value) })
  function onPage(event: P) { adapter()?.page?.(event); events.page(event) }
  function onSort(event: S) { adapter()?.sort?.(event); events.sort(event) }
  function onFilter(event: F) { adapter()?.filter?.(event); events.filter(event) }
  return { search, onPage, onSort, onFilter }
}
