import test from'node:test'
import assert from'node:assert/strict'
import{doctorAdministrationReadiness}from'../../app/utils/administrationReadiness.ts'
const identity={userId:'ae290000-0000-4000-8000-000000000001'}
const raw={subscriber_user_id:identity.userId,suit:'doctor-suit',state:'unavailable',target_binding:'unconfigured',signing:'unconfigured',live_policy:'pending',operator_approval:'pending',capabilities:[],operator_grant_available:false,payment_confirmed:false,live_activation:false}
test('administration readiness cannot borrow another Suit binding or treat operator grants as payment',()=>{
 assert.equal(doctorAdministrationReadiness(raw,identity).operatorGrantAvailable,false)
 for(const patch of[{subscriber_user_id:'other'},{suit:'shop-suit'},{state:'available'},{target_binding:'inherited'},{signing:'configured'},{live_policy:'approved'},{operator_approval:'approved'},{capabilities:['doctor.plan.command']},{operator_grant_available:true},{payment_confirmed:true},{live_activation:true}])assert.throws(()=>doctorAdministrationReadiness({...raw,...patch},identity),/READINESS_INVALID/)
})
