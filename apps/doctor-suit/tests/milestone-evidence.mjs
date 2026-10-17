// A fail-closed receipt comparator for the independent verifier handoff.
// This does not execute verification or supply independent/domain approval.
export function doctorMilestoneReceiptIssues(candidate,receipt) {
  const issues = []
  if(!receipt || receipt.candidateSha!==candidate.headSha || receipt.baseSha!==candidate.baseSha)issues.push('candidate-binding')
  if(!receipt?.executionId || !receipt?.verifierIdentity || receipt.verifierIdentity===candidate.implementationIdentity)issues.push('independent-verifier')
  if(!receipt?.inputHashes || Object.entries(candidate.inputHashes).some(([path,hash]) => receipt.inputHashes[path]!==hash))issues.push('artifact-binding')
  for(const id of ['DOS-M1-020-C03','DOS-M1-020-C04'])if(receipt?.cases?.[id]!=='passed')issues.push(`case:${id}`)
  for(const id of candidate.requiredCommands) {
    const command = receipt?.commands?.find(row => row.id===id)
    if(!command || command.status!=='passed' || command.exitCode!==0 || !Array.isArray(command.argv) || !command.argv.length || !command.startedAt || !command.finishedAt || !command.immutableLog)issues.push(`command:${id}`)
  }
  if(receipt?.domainApprovalGranted || receipt?.deploymentClaimed || receipt?.integrationClaimed)issues.push('authority-overreach')
  return issues
}
