#!/usr/bin/env node
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {validateVerifierOnlyReacceptance} from './verifier-only-reacceptance.mjs'
import {publicationStateFingerprint} from './publication-preflight.mjs'
// JSON context is collected by the operator from the original execution and
// exact human approval event. SQL independently checks those authoritative rows.
const [contextPath,probePath]=process.argv.slice(2)
const context=JSON.parse(readFileSync(contextPath)),probe=JSON.parse(readFileSync(probePath))
const git=(...args)=>execFileSync('git',['-C',context.execution.worktree_path,...args],{encoding:'utf8'}).trim()
const paths=new Set([git('diff','--name-only','HEAD'),git('diff','--cached','--name-only'),git('ls-files','--others','--exclude-standard')].flatMap(s=>s.split('\n').filter(Boolean)))
const currentState={base_sha:git('rev-parse','HEAD'),files:[...paths].sort().map(file=>({file,object:git('hash-object',file)}))}
currentState.fingerprint=publicationStateFingerprint(currentState)
validateVerifierOnlyReacceptance({execution:context.execution,probe,currentState,verifierPaths:context.approval.payload.verifier_paths,requiredChecks:context.approval.payload.required_checks})
const literal=s=>"'"+String(s).replaceAll("'","''")+"'"
const sql=`SELECT control.reaccept_verifier_only(${literal(context.execution.task_id)},${Number(context.execution.execution_id)},${Number(context.approval.event_id)},${literal(JSON.stringify(probe))}::jsonb);`
process.stdout.write(execFileSync('psql',['-X','-w','-At','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8',env:{...process.env,PGHOST:process.env.BS_CONTROL_DB_HOST ?? process.env.PGHOST,PGPORT:process.env.BS_CONTROL_DB_PORT ?? process.env.PGPORT,PGDATABASE:process.env.BS_CONTROL_DB_NAME ?? process.env.PGDATABASE,PGUSER:process.env.BS_CONTROL_VERIFIER_USER ?? process.env.PGUSER,PGSSLMODE:process.env.BS_CONTROL_DB_SSLMODE ?? process.env.PGSSLMODE}}))
