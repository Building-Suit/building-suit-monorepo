/** Local wall-clock value for a native datetime-local control; persistence uses ISO UTC. */
export function localDateTimeInput(date: Date): string {
 const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
 return shifted.toISOString().slice(0, 16)
}
