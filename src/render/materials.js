import * as THREE from 'three';

/** Uniforms shared by every material (fog, flashlight, camera). */
export const U = {
  uCam: { value: new THREE.Vector3() },
  uCamDir: { value: new THREE.Vector3(0, 0, -1) },
  uCamRight: { value: new THREE.Vector3(1, 0, 0) },
  uFlash: { value: 0 },
  uFogColor: { value: new THREE.Color(0.012, 0.012, 0.02) },
  uFogDensity: { value: 0.045 },
  uFar: { value: 52 },
  uTime: { value: 0 },
  uGlow: { value: 0 },
};

const COMMON_FRAG = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uCamDir;
uniform float uFlash;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uTime;

vec3 applyLighting(vec3 albedo, vec3 light, vec3 world, float emit) {
  vec3 toFrag = world - uCam;
  float d = length(toFrag);
  vec3 L = toFrag / max(d, 0.0001);
  float cs = dot(L, uCamDir);
  float cone = smoothstep(0.80, 0.93, cs);
  float att = 1.0 / (1.0 + 0.10 * d + 0.045 * d * d);
  vec3 lit = light + uFlash * cone * att * vec3(1.0, 0.95, 0.78) * 1.7;
  lit = mix(lit, vec3(1.0), emit);
  vec3 col = albedo * lit;
  float f = 1.0 - exp(-(uFogDensity * d) * (uFogDensity * d));
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
`;

const TERRAIN_VERT = /* glsl */ `
attribute float aLayer;
attribute vec3 aLight;
varying vec2 vUv;
varying float vLayer;
varying vec3 vLight;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vLayer = aLayer;
  vLight = aLight;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const TERRAIN_FRAG = /* glsl */ `
uniform sampler2DArray uMap;
uniform float uAlpha;
varying vec2 vUv;
varying float vLayer;
varying vec3 vLight;
varying vec3 vWorld;
${COMMON_FRAG}
void main() {
  vec4 t = texture(uMap, vec3(vUv, vLayer));
#ifdef GLASS
  if (t.a < 0.05) discard;
  vec3 c = applyLighting(t.rgb * vec3(0.75, 0.9, 1.0), vLight, vWorld, 0.0);
  gl_FragColor = vec4(c, max(t.a * uAlpha, 0.28 * uAlpha));
#else
  if (t.a < 0.5) discard;
  gl_FragColor = vec4(applyLighting(t.rgb, vLight, vWorld, 0.0), 1.0);
#endif
}
`;

export function terrainMaterial(tex, glass = false) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uMap: { value: tex }, uAlpha: { value: glass ? 0.6 : 1 } },
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    defines: glass ? { GLASS: 1 } : {},
    side: THREE.DoubleSide,
    transparent: glass,
    depthWrite: !glass,
  });
}

const SPRITE_VERT = /* glsl */ `
attribute vec4 iA;   // pos.xyz, mode (0 billboard, 1 fixed vertical, 2 ceiling, 3 floor)
attribute vec4 iB;   // size.xy, offset.xy
attribute vec4 iUV;  // u0 v0 u1 v1
attribute vec4 iC;   // tint.rgb, alpha
attribute vec4 iD;   // yaw, emit, highlight, spare
uniform vec3 uCam;
uniform vec3 uCamRight;
uniform float uFar;
varying vec2 vUv;
varying vec3 vTint;
varying vec3 vWorld;
varying float vAlpha;
varying float vEmit;
varying float vHi;
void main() {
  float mode = iA.w;
  vec2 cn = position.xy;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 world;
  if (mode < 0.5) {
    // the camera's right, in the frame the sprites are placed in (their grid's: the batch's matrix takes them into the scene)
    mat3 R = mat3(modelMatrix);
    vec3 rl = vec3(dot(R[0], uCamRight), dot(R[1], uCamRight), dot(R[2], uCamRight));
    vec3 r = normalize(vec3(rl.x, 0.0, rl.z));
    world = iA.xyz + r * (iB.z + cn.x * iB.x) + up * (iB.w + cn.y * iB.y);
  } else if (mode < 1.5) {
    vec3 n = vec3(sin(iD.x), 0.0, cos(iD.x));
    vec3 r = vec3(n.z, 0.0, -n.x);
    world = iA.xyz + r * (iB.z + cn.x * iB.x) + up * (iB.w + cn.y * iB.y);
  } else {
    world = iA.xyz + vec3(iB.z + cn.x * iB.x, 0.0, iB.w - (cn.y - 0.5) * iB.y);
  }
  world = (modelMatrix * vec4(world, 1.0)).xyz;
  vUv = vec2(mix(iUV.x, iUV.z, cn.x + 0.5), mix(iUV.w, iUV.y, cn.y));
  vTint = iC.rgb;
  vAlpha = iC.a;
  vEmit = iD.y;
  vHi = iD.z;
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  if (iC.a <= 0.001 || distance(world, uCam) > uFar) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}
`;

const SPRITE_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vTint;
varying vec3 vWorld;
varying float vAlpha;
varying float vEmit;
varying float vHi;
${COMMON_FRAG}
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.45) discard;
  vec3 c = applyLighting(t.rgb, vTint, vWorld, vEmit);
  c += vHi * vec3(0.10, 0.22, 0.30);
  gl_FragColor = vec4(c, 1.0);
}
`;

export function spriteMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uMap: { value: tex } },
    vertexShader: SPRITE_VERT,
    fragmentShader: SPRITE_FRAG,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  });
}
