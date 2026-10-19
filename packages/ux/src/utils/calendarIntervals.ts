export interface CalendarInterval { startMinute: number; endMinute: number }

/** Presentation-only overlap lanes. This does not calculate bookable availability. */
export function layoutCalendarIntervals<T extends CalendarInterval>(items: readonly T[], minimumMinutes = 40) {
  const result: { item: T; lane: number; lanes: number }[] = []
  let group: typeof result = [], laneEnds: number[] = [], groupEnd = -1
  function finish() { for (const item of group) item.lanes = laneEnds.length; result.push(...group); group = []; laneEnds = []; groupEnd = -1 }
  for (const item of [...items].sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute)) {
    if (item.startMinute >= groupEnd && group.length) finish()
    const end = Math.max(item.endMinute, item.startMinute + minimumMinutes)
    let lane = laneEnds.findIndex(value => value <= item.startMinute)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = end
    groupEnd = Math.max(groupEnd, end)
    group.push({ item, lane, lanes: 1 })
  }
  finish()
  return result
}
