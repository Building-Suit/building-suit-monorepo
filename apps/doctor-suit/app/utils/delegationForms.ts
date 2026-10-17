import type { BsAccessIdentityForm } from '@building-suit/ui/access-presentation'
import { doctorAdministrativeCapabilities, type DoctorAdministrativeCapability } from './locationContext.ts'
import type { DoctorDelegationGrant } from './delegation.ts'
export function doctorDelegationPreset(value: string): DoctorAdministrativeCapability[] {
  if (value==='all') return [...doctorAdministrativeCapabilities]
  if (value==='read') return ['dashboard.read','patients.read','appointments.read']
  if (value==='schedule') return ['appointments.read','appointments.write','queue.manage']
  return []
}
export function doctorFormGrants(form: BsAccessIdentityForm): DoctorDelegationGrant[] | null {
  const values: DoctorDelegationGrant[] = []
  for (const id of form.locationIds) {
    const capabilities = form.grants?.find(item => item.locationId===id)?.capabilities || []
    if (capabilities.some(item => !doctorAdministrativeCapabilities.includes(item as DoctorAdministrativeCapability))) return null
    values.push({ locationId: id,capabilities: [...capabilities] as DoctorAdministrativeCapability[] })
  }
  return values
}
