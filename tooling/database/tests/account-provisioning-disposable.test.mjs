import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDisposable, localOrigin } from '../account-provisioning-disposable.mjs'

test('provisioning acceptance refuses ordinary/local/self-hosted execution',()=>{
  for(const environment of [{},{GITHUB_ACTIONS:'true'},{GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'self-hosted',ACCOUNT_PROVISION_DISPOSABLE:'1'}])assert.throws(()=>assertDisposable(environment))
  assert.doesNotThrow(()=>assertDisposable({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',ACCOUNT_PROVISION_DISPOSABLE:'1'}))
})
test('only the two isolated product loopback APIs can receive generated fixture credentials',()=>{
  assert.equal(localOrigin('http://127.0.0.1:61321','shop'),'http://127.0.0.1:61321')
  assert.equal(localOrigin('http://127.0.0.1:64321','sas'),'http://127.0.0.1:64321')
  for(const url of ['https://project.supabase.co','http://localhost:61321','http://127.0.0.1:64321','http://user:password@127.0.0.1:61321'])assert.throws(()=>localOrigin(url,'shop'))
})
