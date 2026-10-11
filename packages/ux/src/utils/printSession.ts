/** Open synchronously from the user gesture; the caller supplies shared presentation output. */
export function openPrintSession(initialMarkup: string) {
 if (typeof window === 'undefined') return null
 const target = window.open('', '_blank')
 if (!target) return null
 target.opener = null
 target.document.write(initialMarkup)
 target.document.close()
 return {
  close: () => target.close(),
  print: (markup: string) => { target.document.open(); target.document.write(markup); target.document.close(); target.focus(); target.print() },
 }
}
