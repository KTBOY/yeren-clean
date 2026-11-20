import * as THREE from 'three'

/**
 * Dark-fantasy ("Diablo-like") treatment for the rigged hunter GLB.
 * Two levers, both applied at load so no external modelling is required:
 *   1. applyHunterSurface — desaturate / darken / weather the baked albedo in-shader and add a
 *      cool rim, while preserving the gameplay hit-flash uniform.
 *   2. buildArmorKit — procedural blackened-iron / dark-leather / brass pieces mounted on named
 *      bones, coverage scaled by armour tier. Pieces are authored in world metres relative to the
 *      bone's rest position; the caller world-aligns and scale-compensates each mount.
 */

const NOISE = /* glsl */ `
float dHash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float dNoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(dHash(i),dHash(i+vec2(1,0)),u.x), mix(dHash(i+vec2(0,1)),dHash(i+vec2(1,1)),u.x), u.y); }
float dFbm(vec2 p){ float s=0.0; float a=0.5; for(int i=0;i<4;i++){ s+=a*dNoise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
`

/** Muted, weathered hide/metal surface + cool rim; keeps the hit-flash. */
export function applyHunterSurface(mat: THREE.MeshStandardMaterial, flashU: { value: number }): void {
  mat.roughness = Math.max(0.75, mat.roughness)
  mat.metalness = Math.min(0.15, mat.metalness)
  mat.envMapIntensity = 0.3
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFlash = flashU
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uFlash;\n${NOISE}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
      {
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.45);
        float greenness = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
        float gm = smoothstep(0.02, 0.12, greenness);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.12, 0.085) * (0.5 + 1.2 * lum), gm);
        #ifdef USE_MAP
          float g = dFbm(vMapUv * 30.0);
          diffuseColor.rgb *= 0.66 + 0.16 * g;
          diffuseColor.rgb *= mix(0.78, 1.0, smoothstep(0.30, 0.72, g));
        #else
          diffuseColor.rgb *= 0.70;
        #endif
      }`)
      .replace('#include <dithering_fragment>', /* glsl */ `
      {
        vec3 nrm = normalize(normal);
        float fres = pow(1.0 - clamp(dot(nrm, normalize(vViewPosition)), 0.0, 1.0), 2.2);
        gl_FragColor.rgb += vec3(0.36, 0.47, 0.64) * fres * 0.36;
      }
      #include <dithering_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.35, 0.25), uFlash * 0.55);`)
  }
}

export type ArmorMount = { bone: string; group: THREE.Group }

const std = (color: string, roughness: number, metalness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })

/** Same cool rim for the armour kit; it is the widest part of the silhouette at night. */
function rimify(mat: THREE.MeshStandardMaterial, strength: number): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', /* glsl */ `
      {
        vec3 nrm = normalize(normal);
        float fres = pow(1.0 - clamp(dot(nrm, normalize(vViewPosition)), 0.0, 1.0), 2.2);
        gl_FragColor.rgb += vec3(0.36, 0.47, 0.64) * fres * ${strength.toFixed(2)};
      }
      #include <dithering_fragment>`)
  }
  mat.customProgramCacheKey = () => `hunter-rim-${strength.toFixed(2)}`
  return mat
}

function kitMaterials() {
  const m = {
    iron: std('#2b2e34', 0.62, 0.45, { envMapIntensity: 0.35, flatShading: true }),
    edge: std('#6a7078', 0.50, 0.60, { envMapIntensity: 0.4, flatShading: true }),
    leather: std('#3a2a1e', 0.90, 0.0),
    brass: std('#8a6a2a', 0.50, 0.70, { envMapIntensity: 0.4 }),
    bone: std('#cfc4a8', 0.60, 0.0),
    ember: std('#2a1008', 0.5, 0.0, { emissive: '#ff5a1a', emissiveIntensity: 1.1 }),
  }
  for (const mat of Object.values(m)) rimify(mat, 0.3)
  return m
}
type KitMats = ReturnType<typeof kitMaterials>

function put(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] | number = 1): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(...pos)
  m.rotation.set(...rot)
  if (typeof scale === 'number') m.scale.setScalar(scale)
  else m.scale.set(...scale)
  m.castShadow = true
  parent.add(m)
  return m
}
const rivets = (parent: THREE.Object3D, mat: THREE.Material, pts: [number, number, number][]) => {
  for (const p of pts) put(parent, new THREE.SphereGeometry(0.014, 6, 5), mat, p)
}

function pauldron(m: KitMats, side: number, spiked: boolean): THREE.Group {
  const g = new THREE.Group()
  put(g, new THREE.SphereGeometry(0.12, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), m.iron, [side * 0.02, 0.03, 0], [0, 0, side * -0.25], [1.15, 0.7, 1.3])
  put(g, new THREE.TorusGeometry(0.11, 0.015, 6, 16), m.edge, [side * 0.02, 0.01, 0], [Math.PI / 2, 0, side * -0.25], [1.15, 1.3, 1])
  rivets(g, m.brass, [[side * 0.08, 0.06, 0.07], [side * 0.08, 0.06, -0.07]])
  if (spiked) put(g, new THREE.ConeGeometry(0.035, 0.16, 6), m.edge, [side * 0.10, 0.10, 0], [0, 0, side * -0.7])
  return g
}
function chest(m: KitMats, runed: boolean): THREE.Group {
  const g = new THREE.Group()
  put(g, new THREE.TorusGeometry(0.17, 0.028, 6, 18), m.leather, [0, 0.02, 0], [Math.PI / 2, 0, 0], [1.15, 1, 1.0])
  put(g, new THREE.BoxGeometry(0.28, 0.30, 0.08), m.iron, [0, -0.02, 0.17], [0.08, 0, 0])
  put(g, new THREE.BoxGeometry(0.20, 0.05, 0.07), m.edge, [0, 0.11, 0.19])
  rivets(g, m.brass, [[-0.10, 0.08, 0.215], [0.10, 0.08, 0.215], [-0.10, -0.12, 0.215], [0.10, -0.12, 0.215]])
  if (runed) put(g, new THREE.BoxGeometry(0.04, 0.14, 0.02), m.ember, [0, -0.02, 0.215])
  return g
}
function belt(m: KitMats): THREE.Group {
  const g = new THREE.Group()
  put(g, new THREE.TorusGeometry(0.16, 0.03, 6, 18), m.leather, [0, 0.02, 0], [Math.PI / 2, 0, 0], [1.1, 1, 0.85])
  put(g, new THREE.BoxGeometry(0.07, 0.07, 0.03), m.brass, [0, 0.02, 0.15])
  return g
}
function helm(m: KitMats): THREE.Group {
  const g = new THREE.Group()
  put(g, new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), m.iron, [0, 0.06, 0], [0, 0, 0], [1, 1.05, 1.1])
  put(g, new THREE.BoxGeometry(0.17, 0.04, 0.05), m.edge, [0, 0.06, 0.10])
  for (const s of [-1, 1]) put(g, new THREE.ConeGeometry(0.032, 0.20, 6), m.bone, [s * 0.10, 0.14, 0], [0, 0, s * -0.9])
  put(g, new THREE.BoxGeometry(0.12, 0.018, 0.02), m.ember, [0, 0.03, 0.12])
  return g
}

/** Coverage scales with armour tier: t0 leather belt/strap → t3 horned, runed plate. */
export function buildArmorKit(tier: number): ArmorMount[] {
  const m = kitMaterials()
  const mounts: ArmorMount[] = []
  const add = (bone: string, group: THREE.Group) => mounts.push({ bone, group })
  add('Hips', belt(m))
  if (tier >= 1) {
    add('LeftArm', pauldron(m, 1, tier >= 2))
    add('RightArm', pauldron(m, -1, tier >= 2))
    add('Spine', chest(m, tier >= 3))
  } else {
    const strap = new THREE.Group()
    put(strap, new THREE.TorusGeometry(0.07, 0.02, 6, 14), m.leather, [0, 0.02, 0], [0.4, 0, 0.3])
    add('LeftArm', strap)
  }
  if (tier >= 3) add('Head', helm(m))
  return mounts
}

/** Dispose every geometry/material in a kit (materials are shared within a kit). */
export function disposeArmorKit(mounts: ArmorMount[]): void {
  const mats = new Set<THREE.Material>()
  for (const { group } of mounts) {
    group.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      mats.add(mesh.material as THREE.Material)
    })
    group.removeFromParent()
  }
  for (const mat of mats) mat.dispose()
}