// The check name is a durable verification identity, not a second command slot.
export function existingCommandIdentity(results,command,worktree){
 const prior=results.find(check=>check.name===command.name)
 if(!prior)return 'new'
 return prior.command===[command.program,...(command.args??[])].join(' ')
   && (prior.working_directory??worktree)===(command.cwd??worktree)
   && (prior.required!==false)===(command.required!==false)?'reuse':'conflict'
}
