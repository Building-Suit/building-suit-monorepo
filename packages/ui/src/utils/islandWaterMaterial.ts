/**
 * HQ's existing WebGL ocean: a bounded Gerstner spectrum plus shading-only ripples.
 * World units follow the existing ~6-unit offices; the main swells span buildings.
 * Technique reference: https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models
 */
import { FULL_TURN, OCEAN_WAVES, OCEAN_RIPPLES, waveFrequency, ISLAND_SHORE_CONFIG as C, waterGlslNumber as f } from './islandWaterConfig.ts'
import { ISLAND_SHORE_EFFECT_GLSL, islandShoreCalls } from './islandShoreShaders.ts'
const waveFrequencies = OCEAN_WAVES.map(wave => waveFrequency(wave.wavelength, wave.speed))
const rippleFrequencies = OCEAN_RIPPLES.map(wave => waveFrequency(wave.wavelength, wave.speed))
const glsl = (value: number) => value.toFixed(8)

/** Only a few phases/uniforms change on the CPU; no per-frame vertex work. */
export function createIslandWaterClock() {
  const phases = new Float32Array(8), ripples = new Float32Array(4), drift = new Float32Array(4)
  const phaseA = phases.subarray(0, 4), phaseB = phases.subarray(4, 8)
  return {
    phaseA, phaseB, ripples, drift,
    update(seconds: number) {
      const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
      // Reduce each angular phase in JS double precision, never reset shader time.
      // All consumers use a whole-turn sin/cos, so wrapping a phase is continuous.
      for (let index = 0; index < OCEAN_WAVES.length; index++) phases[index] = (time * waveFrequencies[index]!) % FULL_TURN
      for (let index = 0; index < OCEAN_RIPPLES.length; index++) ripples[index] = (time * rippleFrequencies[index]!) % FULL_TURN
      drift[0] = Math.sin(time * 0.0137) * 2.1 + Math.sin(time * 0.0071) * 0.7
      drift[1] = Math.cos(time * 0.0113) * 1.9 + Math.sin(time * 0.0053) * 0.8
      drift[2] = Math.sin(time * 0.0191) * 1.3 + Math.cos(time * 0.0083) * 0.6
      drift[3] = Math.cos(time * 0.0167) * 1.4 + Math.sin(time * 0.0067) * 0.5
    },
  }
}

/** Small, smooth value noise with its analytic X/Z gradient; no texture or tiling. */
export const ISLAND_WATER_NOISE_GLSL = `
float islandOceanHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
vec3 islandOceanNoise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  vec2 blend = f * f * (3.0 - 2.0 * f), gradient = 6.0 * f * (1.0 - f);
  float a = islandOceanHash(cell), b = islandOceanHash(cell + vec2(1.0, 0.0));
  float c = islandOceanHash(cell + vec2(0.0, 1.0)), d = islandOceanHash(cell + vec2(1.0));
  float crossTerm = a - b - c + d;
  return vec3(a + (b - a) * blend.x + (c - a) * blend.y + crossTerm * blend.x * blend.y,
    ((b - a) + crossTerm * blend.y) * gradient.x,
    ((c - a) + crossTerm * blend.x) * gradient.y);
}
`

/** Analytic derivatives include the slowly varying packets and coastal envelope. */
export const ISLAND_WATER_SURFACE_GLSL = `
${ISLAND_WATER_NOISE_GLSL}
${ISLAND_SHORE_EFFECT_GLSL}
void islandSwell(vec2 p, vec2 direction, float k, float amplitude, float chop, float phase,
  float seed, vec3 envelope, vec3 turbulence, vec3 footprint, vec4 coast, float distance, float shadowWeight,
  out float componentPhase,
  inout vec3 displacement, inout vec3 tangent, inout vec3 bitangent) {
  float detailT = clamp(k * footprint.x - 0.65, 0.0, 1.0);
  float detail = 1.0 - detailT * detailT * (3.0 - 2.0 * detailT);
  vec2 detailGradient = -6.0 * detailT * (1.0 - detailT) * k * footprint.yz;
  envelope = vec3(envelope.x * detail, envelope.yz * detail + envelope.x * detailGradient);
  vec2 d = normalize(direction), side = vec2(-d.y, d.x);
  float packetPhase = dot(p, side) * k * 0.27 + seed + dot(uWaterDrift.zw, d) * 0.4;
  float packet = 0.90 + 0.10 * sin(packetPhase);
  vec2 packetGradient = side * k * 0.027 * cos(packetPhase);
  float t = clamp(max(distance, 0.0) / ${f(C.shoreInteractionDistance)}, 0.0, 1.0);
  float shallow = 1.0 - t * t * (3.0 - 2.0 * t);
  vec2 shallowGradient = -coast.xy * (6.0 * t * (1.0 - t) / ${f(C.shoreInteractionDistance)});
  float shadow = 1.0 - coast.w * ${f(C.waveShadowStrength)} * shadowWeight;
  float gain = 1.0 + shallow * ${f(C.shallowWaterAmplitudeMultiplier - 1)};
  envelope.yz = (envelope.yz * gain + envelope.x * shallowGradient * ${f(C.shallowWaterAmplitudeMultiplier - 1)}) * shadow;
  envelope.x *= gain * shadow;
  float group = 0.78 + turbulence.x * 0.22;
  float a = amplitude * envelope.x * group * packet;
  vec2 amplitudeGradient = amplitude * (envelope.yz * group * packet
    + envelope.x * (turbulence.yz * 0.22 * packet + group * packetGradient));
  float theta = k * dot(d, p) - phase + seed + turbulence.x * 0.36;
  vec2 phaseGradient = k * d + turbulence.yz * 0.36;
  float incoming = max(0.0, -dot(d, coast.xy));
  float integral = ${f(C.shoreInteractionDistance)} * (0.5 - t + t * t * t - 0.5 * t * t * t * t);
  float delay = ${f(1 / C.shallowWaterSpeedMultiplier - 1)} * incoming * integral;
  float incidenceSide = d.x * coast.y - d.y * coast.x;
  float bend = ${f(C.refractionStrength)} * shallow * incidenceSide;
  vec2 wind = normalize(vec2(${f(OCEAN_WAVES[0].direction[0])}, ${f(OCEAN_WAVES[0].direction[1])})), windSide = vec2(-wind.y, wind.x);
  float crosswind = dot(p, windSide);
  float diffraction = -k * ${f(C.diffractionStrength)} * coast.w * abs(crosswind) * shadowWeight;
  theta += k * delay + bend + diffraction;
  phaseGradient += -k * ${f(1 / C.shallowWaterSpeedMultiplier - 1)} * incoming * shallow * coast.xy
    + ${f(C.refractionStrength)} * incidenceSide * shallowGradient
    - k * ${f(C.diffractionStrength)} * coast.w * sign(crosswind) * windSide * shadowWeight;
  componentPhase = theta;
  chop *= 1.0 + shallow * ${f(C.shallowWaterSteepnessMultiplier - 1)};
  float s = sin(theta), c = cos(theta);
  displacement += vec3(d.x * a * chop * c, a * s, d.y * a * chop * c);
  vec2 heightGradient = amplitudeGradient * s + a * c * phaseGradient;
  vec2 horizontalGradient = chop * (amplitudeGradient * c - a * s * phaseGradient);
  tangent += vec3(d.x * horizontalGradient.x, heightGradient.x, d.y * horizontalGradient.x);
  bitangent += vec3(d.x * horizontalGradient.y, heightGradient.y, d.y * horizontalGradient.y);
}
`

/** Actual sampled shore distance, bed height and face normals arrive with the mesh. */
export const ISLAND_WATER_VERTEX_GLSL = `
  vOcean = vec4(0.0, 1.0, 0.0, 0.0);
  vWaterState = vec4(0.0);
  vWaterCoast = vec4(0.0, 1.0, 1.0, 0.0);
  if (uMaterial > 10.5 && uMaterial < 11.5) {
    float shoreDistance = aNormal.x, offshore = clamp(aNormal.y, 0.0, 1.0);
    vec4 coast = vec4(normalize(aCoast.xy), aCoast.zw);
    vWaterCoast = coast;
    float farT = clamp((offshore - 0.84) / 0.16, 0.0, 1.0);
    float farEnvelope = 1.0 - farT * farT * (3.0 - 2.0 * farT);
    vec3 envelope = vec3(farEnvelope, 0.0, 0.0);
    vec3 turbulence = islandOceanNoise(world.xz * 0.071 + uWaterDrift.xy);
    turbulence.yz *= 0.071;
    vec3 fromEye = world.xyz - uEye;
    float eyeDistance = max(length(fromEye), 0.001), eyeHeight = max(abs(fromEye.y), 0.001);
    float pixelScale = max(uWaterPixelScale, 1.0);
    bool grazing = eyeHeight / eyeDistance < 0.18;
    vec3 footprint = grazing
      ? vec3(eyeDistance / (pixelScale * 0.18), fromEye.xz / (eyeDistance * pixelScale * 0.18))
      : vec3(eyeDistance * eyeDistance / (pixelScale * eyeHeight), 2.0 * fromEye.xz / (pixelScale * eyeHeight));
    vec3 displacement = vec3(0.0), tangent = vec3(1.0, 0.0, 0.0), bitangent = vec3(0.0, 0.0, 1.0);
    float componentPhase = 0.0;
${OCEAN_WAVES.map((wave, index) => `    islandSwell(world.xz, vec2(${glsl(wave.direction[0])}, ${glsl(wave.direction[1])}), ${glsl(FULL_TURN / wave.wavelength)}, ${glsl(wave.amplitude)}, ${glsl(wave.chop)}, uWaterPhase${index < 4 ? 'A' : 'B'}.${'xyzw'[index % 4]}, ${glsl(wave.phase)}, envelope, turbulence, footprint, coast, shoreDistance, ${glsl([1, 0.85, 0.65, 0.35, 0.15, 0, 0][index]!)}, componentPhase, displacement, tangent, bitangent);${index === 0 ? '\n    vWaterState.y = componentPhase;' : ''}`).join('\n')}
    if (shoreDistance < ${f(C.shoreInteractionDistance * 2)}) {
      vec3 reflected = vec3(0.0);
${islandShoreCalls(i => `      reflected += islandReflectedWave(world.xz, uShoreImpact[${i}], uShoreNormal[${i}], uShoreMotion[${i}], ${f(i + 0.31)});`)}
      displacement.y += reflected.x;
      tangent.y += reflected.y; bitangent.y += reflected.z;
    }
    // Vertical run-up intersects the sampled rock; orbital drift vanishes at contact.
    float guardT = clamp(shoreDistance / ${f(C.orbitalGuardDistance)}, 0.0, 1.0);
    float guard = guardT * guardT * (3.0 - 2.0 * guardT);
    vec2 guardGradient = coast.xy * (6.0 * guardT * (1.0 - guardT) / ${f(C.orbitalGuardDistance)});
    tangent.xz = vec2(1.0, 0.0) + (tangent.xz - vec2(1.0, 0.0)) * guard + displacement.xz * guardGradient.x;
    bitangent.xz = vec2(0.0, 1.0) + (bitangent.xz - vec2(0.0, 1.0)) * guard + displacement.xz * guardGradient.y;
    displacement.xz *= guard;
    world.xyz += displacement;
    vOcean = vec4(normalize(cross(bitangent, tangent)), displacement.y);
    vWaterState.x = max(0.0, 1.0 - (tangent.x * bitangent.z - tangent.z * bitangent.x));
    vWaterState.z = shoreDistance + dot(displacement.xz, coast.xy);
    vWaterState.w = aNormal.z;
  }
`

/** Fine detail is shading-only and smoothly filtered by projected pixel footprint. */
export const ISLAND_WATER_DETAIL_GLSL = `
${ISLAND_WATER_NOISE_GLSL}
${ISLAND_SHORE_EFFECT_GLSL}
vec2 islandRipple(vec2 p, vec2 direction, float k, float slope, float phase, float seed,
  vec3 turbulence, float footprint) {
  vec2 d = normalize(direction);
  float detail = 1.0 - smoothstep(0.65, 1.65, k * footprint);
  float theta = k * dot(d, p) - phase + seed + turbulence.x * 0.55;
  return (d + turbulence.yz * (0.55 / k)) * cos(theta) * slope * detail;
}
`

/** Navy absorption, rough analytic sky response and restrained shore/crest foam. */
export const ISLAND_WATER_FRAGMENT_GLSL = `
  if (uMaterial > 10.5 && uMaterial < 11.5) {
    float shoreDistance = vWaterState.z, offshore = clamp(vNormal.y, 0.0, 1.0);
    vec2 p = vLocal.xz;
    // Mask dry terrain and bound run-up to the narrow contact strip.
    if (shoreDistance < -${f(C.maxRunupDistance)} || (shoreDistance < 0.0 && vOcean.w < vWaterState.w + ${f(C.contactClearance)})) discard;
    vec3 view = normalize(uEye - vWorld);
    vec3 surfaceNormal = normalize(vOcean.xyz);
    float facing = max(dot(surfaceNormal, view), 0.0);
    float footprint = length(uEye - vWorld) / max(uWaterPixelScale, 1.0) / max(facing, 0.18);
    vec3 turbulence = islandOceanNoise(mat2(0.80, -0.60, 0.60, 0.80) * p * 0.37 + uWaterDrift.zw);
    // Chain the rotated noise gradient back to world X/Z.
    turbulence.yz = mat2(0.80, 0.60, -0.60, 0.80) * turbulence.yz * 0.37;
    vec2 rippleSlope = vec2(0.0);
${OCEAN_RIPPLES.map((wave, index) => `    rippleSlope += islandRipple(p, vec2(${glsl(wave.direction[0])}, ${glsl(wave.direction[1])}), ${glsl(FULL_TURN / wave.wavelength)}, ${glsl(wave.slope)}, uWaterRipplePhase.${'xyzw'[index]}, ${glsl(wave.phase)}, turbulence, footprint);`).join('\n')}
    float impactFoam = 0.0;
    if (shoreDistance < ${f(C.shoreInteractionDistance * 2)}) {
      vec3 impulses = vec3(0.0);
${islandShoreCalls(i => `      impulses += islandImpactRipples(vWorld.xz, uShoreImpact[${i}], uShoreNormal[${i}], uShoreMotion[${i}]);
      impactFoam += islandImpactFoam(vWorld.xz, uShoreImpact[${i}], uShoreNormal[${i}], uShoreMotion[${i}]);`)}
      rippleSlope += impulses.yz * (1.0 - smoothstep(0.25, 0.85, footprint));
    }
    float shoreDetail = 0.35 + 0.65 * smoothstep(0.0, 0.75, shoreDistance);
    vec3 normal = normalize(surfaceNormal + vec3(-rippleSlope.x, 0.0, -rippleSlope.y) * shoreDetail);
    facing = max(dot(normal, view), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
    // Shore distance approximates depth; no scene-depth/reflection render is needed.
    float depth = max(0.18, -vWaterState.w);
    float shallow = exp(-depth * 0.65);
    vec3 deepWater = mix(uNavyDeep, uNavy, 0.44);
    vec3 shallowWater = mix(uNavy, uSilver, 0.12);
    vec3 waterColor = mix(deepWater, shallowWater, shallow * 0.65);
    vec3 light = normalize(vec3(-1.50, 3.0, 2.0));
    waterColor *= 0.82 + max(dot(normal, light), 0.0) * 0.24 + clamp(vOcean.w, -0.65, 0.65) * 0.13;
    vec3 reflected = reflect(-view, normal);
    // A soft sky lobe, distorted by the actual water normals, stays rough and muted.
    float skyElevation = smoothstep(-0.20, 0.85, reflected.y);
    vec3 sky = mix(mix(uNavyDeep, uNavy, 0.65), mix(uNavy, uSilver, 0.26), skyElevation);
    waterColor = mix(waterColor, sky, 0.16 + fresnel * 0.64);
    vec3 halfLight = normalize(light + view);
    float crestLight = smoothstep(-0.03, 0.24, vOcean.w);
    float roughness = 0.22 + turbulence.x * 0.12 + (1.0 - shoreDetail) * 0.04;
    float highlight = pow(max(dot(normal, halfLight), 0.0), mix(52.0, 24.0, roughness / 0.40));
    waterColor += mix(uNavy, uSilver, 0.67) * highlight * (0.035 + crestLight * 0.085);
    // The existing Brain/base light supplies the only very local warm reflection.
    vec3 toBrain = uBrainLight - vWorld;
    float brainReflection = pow(max(dot(normal, normalize(normalize(toBrain) + view)), 0.0), 20.0);
    waterColor += uAccent * brainReflection * uBrainLightStrength * 0.025 / (1.0 + dot(toBrain.xz, toBrain.xz) * 0.12);
    vec3 foamNoise = islandOceanNoise(mat2(0.60, -0.80, 0.80, 0.60) * p * 1.17 + uWaterDrift.xy * 1.9);
    float foamDetail = 1.0 - smoothstep(0.12, 0.75, footprint);
    foamNoise.x = mix(0.28 + turbulence.x * 0.44, foamNoise.x, foamDetail);
    float shoreFoam = impactFoam * (0.45 + foamNoise.x * 0.55);
    float nearCrest = smoothstep(0.07, 0.15, vWaterState.x) * smoothstep(0.10, 0.32, vOcean.w)
      * exp(-max(shoreDistance, 0.0) / 2.0) * vWaterCoast.z * smoothstep(0.58, 0.85, foamNoise.x) * 0.08;
    float crestFoam = smoothstep(0.055, 0.105, vWaterState.x) * smoothstep(0.12, 0.30, vOcean.w)
      * smoothstep(0.70, 0.91, foamNoise.x) * 0.065 * (1.0 - smoothstep(0.35, 0.85, footprint));
    float foam = clamp(shoreFoam + crestFoam + nearCrest, 0.0, 0.58);
    waterColor = mix(waterColor, mix(uNavy, uSilver, 0.76), foam);
    if (uWaterDebug > 0.5) {
      vec3 debugColor = vec3(0.0);
      if (uWaterDebug < 1.5) debugColor = vec3(smoothstep(-0.2, 0.2, shoreDistance));
      else if (uWaterDebug < 2.5) debugColor = mix(uNavy, uSilver, clamp(0.5 + shoreDistance / 8.0, 0.0, 1.0));
      else if (uWaterDebug < 3.5) debugColor = vec3(vWaterCoast.xy * 0.5 + 0.5, vWaterCoast.z);
      else if (uWaterDebug < 4.5) debugColor = mix(uSilver, uNavy, clamp(depth / ${f(C.shoreInteractionDistance)}, 0.0, 1.0));
      else if (uWaterDebug > 8.5) debugColor = mix(uNavy, uSilver, vWaterCoast.w);
      else {
        debugColor = uNavy;
${islandShoreCalls(i => `        if (uShoreImpact[${i}].z >= 0.0 && uShoreImpact[${i}].w > 0.0) {
          vec2 delta = vWorld.xz - uShoreImpact[${i}].xy;
          vec2 d = islandReflectionDirection(uShoreNormal[${i}], uShoreMotion[${i}], ${f(i + 0.31)});
          float along = dot(delta, d), across = abs(dot(delta, vec2(-d.y, d.x)));
          float marker = 1.0 - smoothstep(0.12, 0.28, length(delta));
          if (uWaterDebug > 7.5) marker = (1.0 - smoothstep(0.06, 0.15, across)) * step(0.0, along) * (1.0 - step(1.5, along));
          vec3 ink = uWaterDebug > 5.5 && uWaterDebug < 6.5 ? mix(uSilver, uAccent, uShoreImpact[${i}].w / ${f(C.maxSplashStrength)}) : uSilver;
          debugColor = mix(debugColor, ink, marker);
        }`)}
      }
      gl_FragColor = vec4(debugColor, 1.0); return;
    }
    float transmission = exp(-depth * 0.85) * (1.0 - fresnel);
    float alpha = mix(0.98, 0.78, transmission) * (1.0 - smoothstep(0.66, 1.0, offshore)) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(waterColor, alpha);
    return;
  }
`
