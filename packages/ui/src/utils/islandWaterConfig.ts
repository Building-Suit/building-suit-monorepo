/** Shared CPU/GPU wave parameters and bounded shoreline effect budgets. */
export const FULL_TURN = Math.PI * 2
export const OCEAN_WAVES = [
  { direction: [0.91, 0.41], wavelength: 41.3, amplitude: 0.240, chop: 0.62, speed: 1.00, phase: 0.41 },
  { direction: [0.78, 0.63], wavelength: 26.7, amplitude: 0.145, chop: 0.55, speed: 0.93, phase: 2.17 },
  { direction: [0.98, 0.20], wavelength: 14.9, amplitude: 0.075, chop: 0.49, speed: 1.04, phase: 4.63 },
  { direction: [0.96, -0.28], wavelength: 9.1, amplitude: 0.052, chop: 0.44, speed: 0.97, phase: 1.39 },
  { direction: [0.69, 0.72], wavelength: 6.3, amplitude: 0.033, chop: 0.37, speed: 1.07, phase: 5.31 },
  { direction: [0.86, -0.51], wavelength: 4.7, amplitude: 0.022, chop: 0.30, speed: 0.89, phase: 3.72 },
  { direction: [0.995, -0.10], wavelength: 3.4, amplitude: 0.015, chop: 0.24, speed: 1.02, phase: 0.83 },
] as const
export const OCEAN_RIPPLES = [
  { direction: [0.94, 0.34], wavelength: 1.53, slope: 0.032, speed: 0.97, phase: 1.21 },
  { direction: [0.71, -0.70], wavelength: 0.87, slope: 0.023, speed: 1.06, phase: 4.37 },
  { direction: [0.42, 0.91], wavelength: 0.49, slope: 0.014, speed: 0.91, phase: 2.59 },
  { direction: [-0.35, 0.94], wavelength: 0.29, slope: 0.008, speed: 1.03, phase: 5.73 },
] as const
export const waveFrequency = (wavelength: number, speed: number) => Math.sqrt(9.81 * FULL_TURN / wavelength) * 0.58 * speed

export const ISLAND_SHORE_CONFIG = Object.freeze({
  coastSamples: 320, waterSegments: 512, waterBands: 64, impactSiteOffset: 0.23, contactHeights: [-0.30, 0, 0.10, 0.25, 0.45, 0.70, 1.00] as readonly number[],
  shoreInteractionDistance: 6, shallowWaterSpeedMultiplier: 0.78,
  shallowWaterAmplitudeMultiplier: 1.18, shallowWaterSteepnessMultiplier: 1.28,
  refractionStrength: 0.16, diffractionStrength: 0.18,
  shoreBandOffsets: [-0.60, -0.32, -0.16, -0.08, -0.025, 0, 0.06, 0.16, 0.35, 0.65, 1.0, 1.4] as readonly number[],
  orbitalGuardDistance: 1.2,
  maxRunupDistance: 0.32, maxRunupHeight: 0.85, contactClearance: 0.012,
  splashThreshold: 0.24, minImpactHeight: 0.13, maxSplashStrength: 1.5,
  splashVerticalForce: 2.65, splashSpread: 0.65, splashOutwardForce: 0.62,
  gravity: 5.4, splashLifetime: 2.0, mistLifetime: 0.9,
  foamThreshold: 0.12, foamLifetime: 6.5, foamSpread: 0.75, foamDrift: 0.14,
  reflectionStrength: 0.085, reflectionDecay: 1.65, reflectionLifetime: 4.8,
  reflectionSpeed: 1.55, reflectionWavelength: 2.9,
  rippleStrength: 0.022, rippleLifetime: 3.1, rippleSpeed: 1.6, rippleWavelength: 1.25,
  waveShadowStrength: 0.62, waveShadowRecoveryDistance: 22, shadowEdgeWidth: 3,
  maxImpacts: 6, particlesPerImpact: 36, impactSites: 64, impactHz: 20,
  siteCooldown: 3.5, impactSeparation: 2.3, minEventGap: 0.16,
  fineSprayDistance: 60, splashDistance: 110, maxPointSize: 22,
})
export const ISLAND_WATER_DEBUG_MODES = ['off', 'mask', 'distance', 'normals', 'depth', 'impacts', 'strength', 'splash', 'reflection', 'shadow'] as const
export type IslandWaterDebug = typeof ISLAND_WATER_DEBUG_MODES[number]
export function islandWaterDebug(value: string | null): IslandWaterDebug {
  return ISLAND_WATER_DEBUG_MODES.find(mode => mode === value) ?? 'off'
}
export const waterGlslNumber = (value: number) => value.toFixed(8)
