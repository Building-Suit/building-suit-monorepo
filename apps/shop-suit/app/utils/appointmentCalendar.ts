export interface CalendarReadResult<T> { data: T | null; error: unknown | null }
export async function readAppointmentCalendar<T extends { appointments: Array<{ id: string }>; workingHours: Array<{ membershipId: string; weekday: number }>; blocks: Array<{ id?: string; membershipId?: string; kind: string; startsAt: string; endsAt: string }> }>(
  days: Date[], to: string, read: (from: string, to: string) => PromiseLike<CalendarReadResult<T>>,
): Promise<T> {
  const windows = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => ({ from: days[index * 7]!.toISOString(), to: days[(index + 1) * 7]?.toISOString() ?? to }))
  const results = await Promise.all(windows.map(window => read(window.from, window.to)))
  const failure = results.find(result => result.error)?.error
  if (failure) throw failure
  if (results.some(result => !result.data)) throw new Error('APPOINTMENT_CALENDAR_UNAVAILABLE')
  const values = results.map(result => result.data!)
  const unique = <R>(rows: R[], key: (row: R) => string) => [...new Map(rows.map(row => [key(row), row])).values()]
  return { ...values[0], appointments: unique(values.flatMap(value => value.appointments), item => item.id), workingHours: unique(values.flatMap(value => value.workingHours), item => `${item.membershipId}:${item.weekday}`), blocks: unique(values.flatMap(value => value.blocks), item => item.id ?? `${item.membershipId}:${item.kind}:${item.startsAt}:${item.endsAt}`) } as T
}

/** Include overnight reservations on every local day they overlap; midnight endings exclude the next day. */
export function appointmentsForCalendarDay<T extends { startsAt: string; endsAt: string }>(items: T[], day: Date): T[] {
  const end = new Date(day); end.setDate(end.getDate() + 1)
  return items.filter(item => new Date(item.startsAt) < end && new Date(item.endsAt) > day).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}
