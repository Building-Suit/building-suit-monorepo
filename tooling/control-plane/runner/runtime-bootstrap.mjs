#!/usr/bin/env node
import {realpathSync} from 'node:fs'
import {spawn} from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import {verifyRuntimeRelease} from './runtime-release.mjs'
const components={supervisor:'supervisor-service.mjs',runner:'bs-agent.mjs',health:'dot-health-server.mjs',events:'dot-event-relay.mjs',operator:'operator-gate.mjs'}
const [component,...args]=process.argv.slice(2)
if(!components[component])throw Error('registered_runtime_component_required')
// Each process pins one complete immutable release before loading any component.
const home=process.env.BS_CONTROL_RELEASE_HOME??path.join(os.homedir(),'.local/lib/building-suit-control-plane')
const source=process.env.BS_CONTROL_PINNED_RUNTIME_ROOT??realpathSync(path.join(home,'current'))
const manifest=verifyRuntimeRelease(source)
const child=spawn(process.execPath,[path.join(source,'tooling/control-plane/runner',components[component]),...args],{
 env:{...process.env,BS_CONTROL_RUNTIME_RELEASE_ID:manifest.release_id,BS_CONTROL_RUNTIME_SOURCE_SHA:manifest.commit},stdio:'inherit'})
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal))
child.on('error',error=>{process.stderr.write(error.message+'\n');process.exitCode=1})
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0)})
