import assert from 'node:assert/strict'
import test from 'node:test'
import {configuredWebsiteDomain,validWebsiteHostnameSuffix,websiteDomain,stagingWebsiteDomain,websiteUrl} from '../../shared/websiteAddress.ts'
import {classifyWebsiteHost,websiteAliasRedirect} from '../../shared/websiteHost.ts'
import {websitePageUrl} from '../../shared/publicWebsite.ts'
import {websitePortalUrl} from '../../shared/customerPortal.ts'
import {websiteBookingUrl} from '../../shared/appointmentBooking.ts'
const stage=stagingWebsiteDomain,prod=websiteDomain,privateOrigin='https://stg.shop.building-suit.com'
test('deployment config is owned, canonical and environment bound; staging never defaults to production',()=>{
 assert.equal(configuredWebsiteDomain({appEnvironment:'production'}),prod)
 assert.equal(configuredWebsiteDomain({appEnvironment:'local',websiteHostnameSuffix:''}),prod)
 assert.equal(configuredWebsiteDomain({appEnvironment:'staging',websiteHostnameSuffix:stage}),stage)
 assert.equal(configuredWebsiteDomain({appEnvironment:'staging'}),null)
 assert.equal(configuredWebsiteDomain({appEnvironment:'staging',websiteHostnameSuffix:prod}),null)
 assert.equal(configuredWebsiteDomain({appEnvironment:'production',websiteHostnameSuffix:stage}),null)
 for(const value of [null,42,{},'evil.test','https://'+stage,'*.'+stage,stage+':443',stage+'/',stage+'.',stage.toUpperCase(),' '+stage,stage+'\n','foo@'+stage,'xn--x.'+stage,'127.0.0.1']){
  assert.equal(validWebsiteHostnameSuffix(value),false,String(value))
  assert.equal(configuredWebsiteDomain({appEnvironment:'staging',websiteHostnameSuffix:value}),null)
  assert.throws(()=>websiteUrl('alpha-tools',value),/INVALID_WEBSITE_HOSTNAME_SUFFIX/)
 }
 assert.equal(configuredWebsiteDomain({appEnvironment:'stg',websiteHostnameSuffix:stage}),null)
})
test('exact staging and production authority resolve one slug with no cross-environment/private fallback',()=>{
 assert.deepEqual(classifyWebsiteHost('ALPHA-TOOLS.STG.SHOPS.BUILDING-SUIT.COM',privateOrigin,'staging',stage),{kind:'website',slug:'alpha-tools'})
 assert.deepEqual(classifyWebsiteHost('alpha-tools.'+prod,privateOrigin,'production'),{kind:'website',slug:'alpha-tools'})
 for(const host of ['alpha-tools.'+prod,stage,prod,'www.'+stage,'a.b.'+stage,'alpha-tools.'+stage+':443','alpha-tools.'+stage+'.','alpha-tools.'+stage+'.evil.test','alpha-tools%2e'+stage,'alpha-tools.'+stage+',evil.test','alpha-tools@'+stage])assert.equal(classifyWebsiteHost(host,privateOrigin,'staging',stage).kind,'denied',host)
 assert.equal(classifyWebsiteHost('alpha-tools.'+stage,privateOrigin,'production',prod).kind,'denied')
 assert.equal(classifyWebsiteHost('alpha-tools.'+prod,'https://alpha-tools.'+prod,'staging',stage).kind,'denied')
 assert.equal(classifyWebsiteHost('alpha-tools.'+stage,'https://alpha-tools.'+stage,'production',prod).kind,'denied')
 for(const suffix of [undefined,'',prod,'evil.test'])assert.equal(classifyWebsiteHost('alpha-tools.'+stage,privateOrigin,'staging',suffix).kind,'denied')
 assert.equal(classifyWebsiteHost('stg.shop.building-suit.com',privateOrigin,'staging','evil.test').kind,'private')
 assert.equal(classifyWebsiteHost('localhost:3001',privateOrigin,'local','evil.test').kind,'private')
})
test('all public URL forms use one validated suffix, preserving production defaults and safe aliases',()=>{
 assert.equal(websiteUrl('alpha-tools'), 'https://alpha-tools.'+prod)
 assert.equal(websitePageUrl('alpha-tools','en',2,stage),'https://alpha-tools.'+stage+'/?lang=en&page=2')
 assert.equal(websitePortalUrl('alpha-tools','en',stage),'https://alpha-tools.'+stage+'/my-appointments?lang=en')
 assert.equal(websiteBookingUrl('alpha-tools','ar',stage),'https://alpha-tools.'+stage+'/book')
 assert.equal(websiteAliasRedirect('alpha-alias',{canonicalSlug:'alpha-tools',isAlias:true},stage),'https://alpha-tools.'+stage)
 assert.equal(websiteAliasRedirect('alpha-alias',{canonicalSlug:'//evil.test',isAlias:true},stage),null)
})
