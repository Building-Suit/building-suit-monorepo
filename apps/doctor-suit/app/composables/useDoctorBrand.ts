import { brands } from '@building-suit/brand'
export function useDoctorBrand() {
  return { name: brands.doctor.name, assetPrefix: useRuntimeConfig().public.doctorBrand.assetPrefix }
}
