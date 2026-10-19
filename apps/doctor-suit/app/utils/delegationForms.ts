import type { BsAccessIdentityForm } from '@building-suit/ui/access-presentation'
import { doctorAdministrativeCapabilities, type DoctorAdministrativeCapability } from './locationContext.ts'
import type { DoctorDelegationGrant } from './delegation.ts'
export function doctorDelegationPreset(value: string, permitted: readonly DoctorAdministrativeCapability[] = doctorAdministrativeCapabilities): DoctorAdministrativeCapability[] {
  const selected: readonly DoctorAdministrativeCapability[] = value==='all' ? doctorAdministrativeCapabilities : value==='read' ? ['dashboard.read','patients.read','appointments.read'] : value==='schedule' ? ['appointments.read','appointments.write','queue.manage'] : []
  return selected.filter(capability => permitted.includes(capability))
}
export function doctorFormGrants(form: BsAccessIdentityForm, permitted: readonly DoctorAdministrativeCapability[] = doctorAdministrativeCapabilities): DoctorDelegationGrant[] | null {
  const values: DoctorDelegationGrant[] = []
  for (const id of form.locationIds) {
    const capabilities = form.grants?.find(item => item.locationId===id)?.capabilities || []
    if (capabilities.some(item => !permitted.includes(item as DoctorAdministrativeCapability))) return null
    values.push({ locationId: id,capabilities: [...capabilities] as DoctorAdministrativeCapability[] })
  }
  return values
}
