// Only called inside the owned actual-provider lifecycle. Credentials and financial fixtures stay in memory.
import { randomUUID } from 'node:crypto'
export async function preparePracticeBillingBrowser({ sql, a, b, rpc, expect, setStage }) {
 setStage('actual billing fixture owned scope');
 const ids = [a, b].flatMap(actor => [actor.user.id, actor.scope.practiceId, actor.scope.locationId, actor.scope.patientId, actor.sessionId])
 expect(ids.every(value => /^[a-f0-9-]{36}$/.test(value)), 'Owned billing fixture scope required')
 const en = randomUUID(), ar = randomUUID(), readonlyVisit = randomUUID(), terms = randomUUID(), period = randomUUID(), reference = 'SYNTHETIC-BILLING-' + randomUUID()
 setStage('actual billing fixture independent readonly state');
 const before = await rpc(b.client, 'doctor_saas_status'); expect(before.state === 'unconfigured', 'Independent readonly fixture must begin unconfigured')
 function appointment(actor, id, days, hours) { return `('${id}','${actor.scope.practiceId}','${actor.user.id}','${actor.scope.locationId}','${actor.scope.patientId}',clock_timestamp()-interval'${days} days'+interval'${hours} hours',clock_timestamp()-interval'${days} days'+interval'${hours} hours 20 minutes',(select timezone from public.locations where id='${actor.scope.locationId}'),(select name from public.locations where id='${actor.scope.locationId}'),'completed','${actor.user.id}',clock_timestamp()-interval'${days} days'+interval'${hours} hours',clock_timestamp()-interval'${days} days'+interval'${hours} hours',clock_timestamp()-interval'${days} days'+interval'${hours} hours 20 minutes')` }
 setStage('actual billing fixture readonly terms and period');
 sql(`insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values('${terms}','synthetic-readonly-billing',1,'approved','EGP',2,1,7,4,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-readonly-billing/v1','SYNTHETIC_NOT_COMMERCIAL_APPROVAL','SYNTHETIC_NOT_LEGAL_APPROVAL');
 with moment as(select(clock_timestamp()at time zone'UTC')-interval'1 hour'as stamp)
 insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)select'${period}','${b.user.id}','${terms}','trial',stamp at time zone'UTC',(stamp+interval'7 days')at time zone'UTC','synthetic-readonly-billing/v1'from moment;
 insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)values('${b.user.id}','${period}','enabled','trial_started');
`)
 const addVisits=(actor,rows)=>sql(`set request.jwt.claims='${JSON.stringify({sub:actor.user.id,session_id:actor.sessionId,role:'authenticated'})}';insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,checked_in_at,started_at,completed_at)values${rows.join(',')};`)
 setStage('actual billing fixture owner visit sources');
 addVisits(a,[appointment(a,en,20,1),appointment(a,ar,20,2)]);setStage('actual billing fixture readonly visit source');addVisits(b,[appointment(b,readonlyVisit,21,1)])
 setStage('actual billing fixture readonly service price');
 const price = await rpc(b.client, 'doctor_write_service_price', { p_practice: b.scope.practiceId, p_location: b.scope.locationId, p_service: null, p_revision: 0, p_label: reference + '-READONLY', p_minor: '12345', p_currency: 'EGP', p_exponent: 2, p_key: randomUUID() })
 setStage('actual billing fixture readonly charge');
 await rpc(b.client, 'doctor_write_visit_charge', { p_practice: b.scope.practiceId, p_location: b.scope.locationId, p_visit: readonlyVisit, p_visit_version: 1, p_patient: b.scope.patientId, p_price: price.id, p_quantity: 1, p_charge: null, p_revision: 0, p_reason: 'SYNTHETIC_READONLY_HISTORY_FIXTURE', p_key: randomUUID() })
 setStage('actual billing fixture readonly account hold');
 sql(`update public.doctor_saas_accounts set state='suspended',revision=revision+1,reason_code='operator_hold'where subscriber_user_id='${b.user.id}';`)
 setStage('actual billing fixture inactive history board');
 const readonly = await rpc(b.client, 'doctor_practice_billing_board', { p_practice: b.scope.practiceId, p_location: b.scope.locationId })
 expect(readonly.can_write === false && readonly.charge_total === 1 && readonly.charges[0].charge.amount_minor === '12345', 'Inactive fixture must retain owned history without write authority')
 setStage('actual billing fixture browser source metadata');
 const metadata = JSON.parse(sql(`select json_build_object('timezone',(select timezone from public.locations where id='${a.scope.locationId}'),'EN',json_build_object('visit_id','${en}','patient_id','${a.scope.patientId}','version',1,'starts_at',(select starts_at from public.appointments where id='${en}'),'patient_name',(select display_name from public.practice_patients where id='${a.scope.patientId}')),'AR',json_build_object('visit_id','${ar}','patient_id','${a.scope.patientId}','version',1,'starts_at',(select starts_at from public.appointments where id='${ar}'),'patient_name',(select display_name from public.practice_patients where id='${a.scope.patientId}')));`))
 return { fixture: { reference, ...metadata, readonlyServiceLabel: reference + '-READONLY' }, cleanup: () => sql(`update public.doctor_saas_accounts set state='enabled',revision=revision+1,reason_code='operator_resume'where subscriber_user_id='${b.user.id}';`) }
}
export async function verifyPracticeBillingBrowserRecords({ a, b, rpc, expect, fixture, originalPeriod }) {
 const board = await rpc(a.client, 'doctor_practice_billing_board', { p_practice: a.scope.practiceId, p_location: a.scope.locationId })
 for (const locale of ['EN', 'AR']) {
  const source = board.charges.find(c => c.charge.label === fixture.reference + '-' + locale)
  expect(source && source.charge.visit_id === fixture[locale].visit_id && source.charge.visit_version === fixture[locale].version && source.charge.patient_id === a.scope.patientId && source.charge.revision === 2 && source.charge.amount_minor === '18075' && source.charge.currency === 'EGP' && source.charge.currency_exponent === 2, 'Actual GUI charge/correction source differs')
  const history = await rpc(a.client, 'doctor_visit_charge_history', { p_practice: a.scope.practiceId, p_location: a.scope.locationId, p_charge: source.charge.charge_id })
  expect(history.total === 2 && history.items[0].charge.amount_minor === '18075' && history.items[1].charge.amount_minor === '25110' && history.items[1].price.unit_minor === '12555', 'Actual history rewrote original charge after price change')
 }
 const status = await rpc(a.client, 'doctor_saas_status')
 expect(status.state === 'paid' && status.period.id === originalPeriod.id && status.period.ends_at === originalPeriod.ends_at, 'Practice charges changed SaaS subscription')
 expect((await b.client.rpc('doctor_practice_billing_board', { p_practice: a.scope.practiceId, p_location: a.scope.locationId })).error?.code === '42501', 'Independent doctor read foreign practice charges')
 console.log('Actual practice billing: EN/AR browser price versions, exact visit charges, original-key lost-ack retry, immutable correction/history, inactive-owner readonly view, foreign-owner denial and unchanged SaaS period passed; tax/live collection approval remains unavailable.')
}
