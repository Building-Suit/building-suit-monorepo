// C03 exercise inside the existing run-owned Auth/PostgREST lifecycle only.
// Persisted synthetic transport is not real delivery or incident governance.
import { randomUUID } from 'node:crypto'
import { createMessageOutboxReader, messageOutboxState } from '../app/utils/messageOutbox.ts'

export async function verifyDoctorIncidentProvider({ publicKey, bootstrap, rpc, trace, setStage }) {
  setStage('C03 synthetic incident fixtures')
  const owner = await bootstrap(publicKey, 'incident-owner', undefined, 'Etc/UTC')
  const other = await bootstrap(publicKey, 'incident-other', undefined, 'Etc/UTC')
  const base = { p_practice: owner.scope.practiceId, p_location: owner.scope.locationId, p_patient: owner.scope.patientId }
  const contact = randomUUID(), consent = randomUUID()
  const contactCommand = (record, action, input) => rpc(owner.client, 'doctor_contact_command', {
    ...base, p_record: record, p_expected_version: 0, p_action: action, p_input: input, p_key: randomUUID(),
  })
  await contactCommand(contact, 'create_contact', { channel: 'sms', destination: '+15550007708', recipient_kind: 'patient', guardian_id: null })
  const recorded = new Date(Date.now() - 60000)
  await contactCommand(consent, 'grant_consent', {
    contact_id: contact, contact_version: 1, purpose: 'appointment_reminder', source_ref: 'Synthetic incident exercise only',
    source_day: recorded.toISOString().slice(0, 10), source_minute: recorded.getUTCHours() * 60 + recorded.getUTCMinutes(), location_version: 1,
  })
  const command = (message, version, action, input = {}) => ({
    ...base, p_message: message, p_version: version, p_action: action, p_input: input, p_key: randomUUID(),
  })
  const write = args => rpc(owner.client, 'doctor_outbox_command', args)
  const read = () => rpc(owner.client, 'doctor_outbox', { ...base, p_page: 0 })
  const row = async message => (await read()).rows.find(item => item.id === message)
  const reader = actor => createMessageOutboxReader(async (practice, location, patient, page, signal) => {
    const result = await actor.client.rpc('doctor_outbox', { p_practice: practice, p_location: location, p_patient: patient, p_page: page }).abortSignal(signal)
    if (result.error) throw { code: result.error.code }
    return result.data
  }, messageOutboxState(), () => ({
    userId: actor.user.id, sessionId: actor.sessionId, practiceId: owner.scope.practiceId, locationId: owner.scope.locationId,
    portal: 'doctor', environment: 'local', grantsVersion: 1,
  }), trace.record)
  const ownReader = reader(owner), deniedReader = reader(other)
  const observed = signal => trace.snapshot().alerts.filter(value => value === signal).length
  const enqueue = async () => {
    const message = randomUUID()
    await write(command(message, 0, 'enqueue', {
      intent: { contact_id: contact, contact_version: 1, purpose: 'appointment_reminder', consent_version: 1, guardian_version: null },
      expires_at: new Date(Date.now() + 86400000).toISOString(), template: 'appointment_reminder_v1', parameters: {},
    }))
    return { message, claim: await write(command(message, 1, 'claim')) }
  }
  const noResend = async (message, before) => {
    const result = await owner.client.rpc('doctor_outbox_command', command(message, before.version, 'claim')).abortSignal(AbortSignal.timeout(15000))
    const after = await row(message)
    return result.error?.code === '40001' && after.state === before.state && after.version === before.version && after.attempts === before.attempts
  }
  try {
    setStage('C03 known acceptance timeout detection and containment')
    const known = await enqueue()
    // Lose the synthetic acknowledgement after actual persisted acceptance.
    await write(command(known.message, 2, 'accept', { claim_token: known.claim.claim_token }))
    await write(command(known.message, 3, 'timeout', { claim_token: known.claim.claim_token }))
    const uncertain = await row(known.message)
    trace.check('known.timeout_unknown', uncertain.state === 'unknown' && uncertain.attempts === 1)
    trace.check('known.alert_captured', await ownReader.read(owner.scope.patientId) && observed('outbox.unknown_observed') === 1)
    trace.check('known.no_resend', await noResend(known.message, uncertain))
    setStage('C03 evidence-backed synthetic reconciliation')
    await write(command(known.message, uncertain.version, 'reconcile'))
    const reconciled = await row(known.message)
    trace.check('known.reconcile_sent', reconciled.state === 'sent' && reconciled.attempts === 1 && await ownReader.read(owner.scope.patientId) && observed('outbox.sent_observed') === 1)
    trace.check('known.not_delivered', ownReader.state.directory.rows.every(item => item.state !== 'delivered' && item.external_delivery === false && item.data_mode === 'synthetic'))

    setStage('C03 unknown without acceptance remains contained')
    const missing = await enqueue()
    await write(command(missing.message, 2, 'timeout', { claim_token: missing.claim.claim_token }))
    const unknown = await row(missing.message), alertsBefore = observed('outbox.unknown_observed')
    trace.check('missing.timeout_unknown', unknown.state === 'unknown' && unknown.attempts === 1)
    trace.check('missing.alert_captured', await ownReader.read(owner.scope.patientId) && observed('outbox.unknown_observed') === alertsBefore + 1)
    trace.check('missing.no_resend', await noResend(missing.message, unknown))
    await write(command(missing.message, unknown.version, 'reconcile'))
    const held = await row(missing.message)
    trace.check('missing.reconcile_stays_unknown', held.state === 'unknown' && held.blocker === 'acceptance_unknown' && held.attempts === 1 && await noResend(missing.message, held))

    setStage('C03 authorization anomaly and isolated alert capture')
    const beforeDenial = JSON.stringify(await read())
    trace.check('denied.rejected', await deniedReader.read(owner.scope.patientId) === false && deniedReader.state.error === 'denied' && deniedReader.state.directory === null)
    trace.check('denied.alert_captured', observed('outbox.access_rejected') === 1)
    trace.check('denied.owner_unchanged', JSON.stringify(await read()) === beforeDenial && await ownReader.read(owner.scope.patientId))
    const captured = trace.snapshot()
    const privateValues = [contact, consent, known.message, missing.message, known.claim.claim_token, missing.claim.claim_token,
      owner.user.id, other.user.id, owner.scope.patientId, owner.scope.practiceId, owner.sessionId, '+15550007708', 'Synthetic incident exercise only']
    trace.check('capture.bounded_redacted', captured.alerts.length > 0 && captured.alerts.length <= 64 && !captured.rejected && privateValues.every(value => !JSON.stringify(captured).includes(value)))
  } finally {
    ownReader.clear(); deniedReader.clear()
    await Promise.allSettled([owner.client.removeAllChannels(), other.client.removeAllChannels()])
  }
}
