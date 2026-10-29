import test from 'node:test'
import assert from 'node:assert/strict'
import {renderReportDocument} from '../src/utils/reportDocument.ts'
test('clinical print isolation is opt-in and preserves literal escaped values',()=>{
 const metadata={title:'Synthetic',organization:'Synthetic <practice>',currency:'1',generatedAt:'2026-10-20',direction:'rtl',labels:{organization:'Practice',currency:'Revision',generatedAt:'Recorded',warning:'Status'},filters:[]}
 const value='Synthetic <script>literal</script> / تعليمات اصطناعية'
 const legacy=renderReportDocument(['Entered'],[[value]],new Set(),metadata)
 assert.equal(legacy.includes('<bdi>'),false)
 assert.ok(legacy.includes('<td>Synthetic &lt;script&gt;literal&lt;/script&gt; / تعليمات اصطناعية</td>'))
 const isolated=renderReportDocument(['Entered'],[[value]],new Set(),{...metadata,isolateValues:true})
 assert.ok(isolated.includes('<td><bdi>Synthetic &lt;script&gt;literal&lt;/script&gt; / تعليمات اصطناعية</bdi></td>'))
 assert.ok(isolated.includes('<dd><bdi>Synthetic &lt;practice&gt;</bdi></dd>'))
 assert.equal(isolated.includes('<script>'),false)
})
