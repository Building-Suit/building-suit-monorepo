import test from 'node:test'
import assert from 'node:assert/strict'
import {sharedPlanningCommand} from '../runner/shared-planning-operator.mjs'
const run='1a75a547-3372-4e2a-b51c-3b1b2bf9ad81',env={BS_OPERATOR_DB_USER:'test-operator'}
test('planning command routes only explicit owner evidence to dedicated operator',()=>{
 const result=sharedPlanningCommand(['repair',run,'147862b56eb8e0f2417a5d4a8d768bee',"Owner's explicit audited planning instruction"],env,(sql,route)=>({sql,route}))
 assert.equal(result.route.BS_CONTROL_DB_USER,'test-operator')
 assert.match(result.sql,/Owner''s explicit/)
 assert.match(result.sql,/repair_shared_future_suit_dependency/)
 const decision=sharedPlanningCommand(['decisions',run,'semantic-prerelease','48','Owner explicitly approved both choices'],env,sql=>sql)
 assert.match(decision,/approve_shared_changelog_choices/)
})
test('missing authority, wrong run, implicit choices and extra arguments fail closed',()=>{
 const args=['repair',run,'147862b56eb8e0f2417a5d4a8d768bee','Explicit owner planning evidence']
 assert.throws(()=>sharedPlanningCommand(args,{}))
 for(const a of [[...args,'extra'],['repair','other',...args.slice(2)],['decisions',run,'recommended','48','Explicit owner planning evidence'],['decisions',run,'semantic-prerelease','72','Explicit owner planning evidence']])assert.throws(()=>sharedPlanningCommand(a,env))
})
