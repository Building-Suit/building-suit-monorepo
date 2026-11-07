import { ISLAND_SHORE_CONFIG as C, waterGlslNumber as f } from './islandWaterConfig.ts'

export const ISLAND_SHORE_UNIFORMS_GLSL = `
uniform vec4 uShoreImpact[${C.maxImpacts}];
uniform vec4 uShoreNormal[${C.maxImpacts}];
uniform vec4 uShoreMotion[${C.maxImpacts}];
uniform float uWaterDebug;
`

/** Shared ballistic path: the designated large droplet and its return ripple agree. */
export const ISLAND_SPLASH_VELOCITY_GLSL = `
vec3 islandSplashVelocity(vec4 coast, vec4 motion, float strength, float seed, float kind) {
  vec2 n = normalize(coast.xy), side = vec2(-n.y, n.x), incoming = normalize(motion.xy);
  float spread = sin(seed * 73.17) * ${f(C.splashSpread)};
  float scale = sqrt(max(strength, 0.0));
  vec2 horizontal = n * ${f(C.splashOutwardForce)} * scale
    + side * (spread + dot(incoming, side) * (1.0 - coast.z) * 0.65) * scale;
  float up = motion.z * (0.78 + seed * 0.44) * (kind < 0.5 ? 1.0 : (kind < 1.5 ? 0.80 : 0.48));
  return vec3(horizontal.x, up, horizontal.y);
}
`

export const ISLAND_SHORE_EFFECT_GLSL = `
${ISLAND_SPLASH_VELOCITY_GLSL}
vec2 islandReflectionDirection(vec4 coast, vec4 motion, float seed) {
  vec2 n = normalize(coast.xy), side = vec2(-n.y, n.x);
  return normalize(reflect(normalize(motion.xy), n) + side * sin(seed * 19.13) * 0.08);
}
vec3 islandReflectedWave(vec2 p, vec4 event, vec4 coast, vec4 motion, float seed) {
  float age = event.z;
  if (age < 0.0 || age > ${f(C.reflectionLifetime)} || event.w < ${f(C.splashThreshold)}) return vec3(0.0);
  vec2 d = islandReflectionDirection(coast, motion, seed), side = vec2(-d.y, d.x), delta = p - event.xy;
  float along = dot(delta, d) - age * ${f(C.reflectionSpeed)}, across = dot(delta, side);
  float width = 1.10 + age * 0.35, lengthScale = 1.2 + age * 0.25;
  float squared = along * along / (lengthScale * lengthScale) + across * across / (width * width);
  if (squared > 12.0) return vec3(0.0);
  float envelope = exp(-squared - age / ${f(C.reflectionDecay)}) * smoothstep(0.0, 0.16, age)
    * (1.0 - smoothstep(${f(C.reflectionLifetime - 0.6)}, ${f(C.reflectionLifetime)}, age));
  float k = 6.28318531 / (${f(C.reflectionWavelength)} * (0.94 + sin(seed * 2.7) * 0.08));
  float theta = k * (dot(delta, d) - age * ${f(C.reflectionSpeed)}) + 1.57079633;
  float amplitude = event.w * ${f(C.reflectionStrength)} * (0.3 + coast.z * 0.7);
  vec2 gradEnvelope = envelope * (-2.0 * along * d / (lengthScale * lengthScale) - 2.0 * across * side / (width * width));
  return vec3(amplitude * envelope * sin(theta), amplitude * (gradEnvelope * sin(theta) + envelope * cos(theta) * k * d));
}
vec3 islandRing(vec2 delta, float age, float strength) {
  if (age <= 0.0 || age > ${f(C.rippleLifetime)}) return vec3(0.0);
  float radius = length(delta), front = radius - age * ${f(C.rippleSpeed)};
  float envelope = exp(-front * front / 0.38 - age * 0.82) * smoothstep(0.0, 0.12, age)
    * (1.0 - smoothstep(${f(C.rippleLifetime - 0.5)}, ${f(C.rippleLifetime)}, age));
  float k = 6.28318531 / ${f(C.rippleWavelength)}, theta = k * front;
  float amplitude = strength * ${f(C.rippleStrength)};
  float slope = amplitude * envelope * (k * cos(theta) - front * (2.0 / 0.38) * sin(theta));
  return vec3(amplitude * envelope * sin(theta), delta / max(radius, 0.05) * slope);
}
vec3 islandImpactRipples(vec2 p, vec4 event, vec4 coast, vec4 motion) {
  if (event.z < 0.0 || event.w < ${f(C.splashThreshold)}) return vec3(0.0);
  vec3 result = islandRing(p - event.xy, event.z, event.w * 0.55);
  // One selected large droplet returns once. There is no recursive emission.
  if (event.w > ${f(C.splashThreshold * 1.5)}) {
    vec3 velocity = islandSplashVelocity(coast, motion, event.w, 0.5, 0.0);
    float landing = (velocity.y + sqrt(velocity.y * velocity.y + 2.0 * ${f(C.gravity)} * max(motion.w, 0.0))) / ${f(C.gravity)};
    result += islandRing(p - event.xy - velocity.xz * landing, event.z - landing, event.w * 0.32);
  }
  return result;
}
float islandImpactFoam(vec2 p, vec4 event, vec4 coast, vec4 motion) {
  float age = event.z;
  if (age < 0.0 || age > ${f(C.foamLifetime)} || event.w < ${f(C.foamThreshold)}) return 0.0;
  vec2 n = normalize(coast.xy), side = vec2(-n.y, n.x);
  vec2 drift = n * age * ${f(C.foamDrift)} + normalize(motion.xy) * sin(age * 1.1) * 0.10;
  vec2 delta = p - event.xy - drift;
  float width = ${f(C.foamSpread)} + age * 0.24;
  float spread = (1.0 - coast.z) * 1.5 + 1.0;
  float footprint = dot(delta, n) * dot(delta, n) / (width * width)
    + dot(delta, side) * dot(delta, side) / (width * width * spread);
  return exp(-footprint - age * (3.0 / ${f(C.foamLifetime)})) * smoothstep(0.0, 0.09, age)
    * (1.0 - smoothstep(${f(C.foamLifetime - 0.8)}, ${f(C.foamLifetime)}, age)) * event.w * (0.28 + coast.z * 0.35);
}
`
export const islandShoreCalls = (call: (index: number) => string) => Array.from({ length: C.maxImpacts }, (_, index) => call(index)).join('\n')
