/** Group hierarchy is independent of the authority to receive journal entries. */
export function isPostingAccount(account: { account_role: string, is_archived: boolean }): boolean {
  return account.account_role === 'posting' && !account.is_archived
}
