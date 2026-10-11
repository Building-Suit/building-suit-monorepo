// Bounded independent content review of the preserved candidates, not owner
// authority or verification. These exact API artifacts use the unchanged
// project-session/owner helper and ordinary user RPC client. No service-role
// client, secret access or change to the authorization helper is admitted here.
// A changed file, parent, execution, witness or verification needs a new review.
export const ordinarySourceReviews = Object.freeze([
  {task_id:'SAS-M1-CUSTOM-OFFER-001',execution_id:321,
    path:'apps/super-admin-suit/server/api/custom-offers.post.ts',object:'9473fe881d1f82f8f9f031c70cbbff6aa1d71c6f'},
  {task_id:'SAS-M1-AUDIT-001',execution_id:322,
    path:'apps/super-admin-suit/server/api/activity.get.ts',object:'432ec082ef40843e052feea14ead4cfe4d8f4f5b'},
].map(review=>Object.freeze({...review,
  parent_sha:'3b5190844571d4fab329ef6b53e2f520586fb57c',
  witness_path:'apps/super-admin-suit/server/utils/authorize.ts',
  witness_object:'dfdb45198c29beb21fb7553513018edb5f97f753',
})))

export function reviewedOrdinarySourcePaths({task,execution,verification,objects}) {
  if (verification?.status !== 'passed' || Number(verification.execution_id)!==Number(execution?.execution_id)) return []
  return ordinarySourceReviews.filter(review=>review.task_id===task?.task_id &&
    review.execution_id===Number(execution?.execution_id) && review.parent_sha===execution?.parent_sha &&
    objects[review.path]===review.object && objects[review.witness_path]===review.witness_object &&
    verification.verified_state?.files?.some(file=>file.file===review.path && file.object===review.object)
  ).map(review=>review.path)
}
