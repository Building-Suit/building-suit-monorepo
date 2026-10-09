// A queue grant authorizes ordinary source publication. Existing protected-path
// grants remain separate, and it does not authorize unknown access-control edits.
export function unattendedSensitiveFiles(files) {
 return files.filter(file=>/^(?:packages\/(?:auth|contracts|data-access)\/|\.github\/|\.gitmodules$)|(?:^|\/)(?:auth|security|permissions?|polic(?:y|ies)|oauth|jwt)(?:\/|[.-])|(?:^|\/)server\/(?:api|middleware|plugins)\//i.test(file))
}

// Reconcile a previously created exact Draft after another eligible task became
// the stack leaf. This authorizes no new commit, push or retargeting.
export function frozenDraftReplay({pr,execution,localSha,remoteSha,recordedParentSha,taskCommitsOnly}) {
 return pr?.state==='OPEN' && pr.isDraft===true && pr.headRefName===execution.branch_name && pr.baseRefName===execution.parent_branch
  && /^[a-f0-9]{40}$/.test(localSha??'') && pr.headRefOid===localSha && remoteSha===localSha
  && recordedParentSha===execution.parent_sha && localSha!==execution.parent_sha && taskCommitsOnly===true
}
