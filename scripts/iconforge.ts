// Offline icon forge: builds the four skill-bar weapons as PBR meshes and renders them
// to transparent PNGs. Dev-only (vite build inputs exclude this page) — run `pnpm icons`.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

type IconOut = { name: string; data: string }
declare global {
  interface Window { __icons?: IconOut[]; __iconNames?: string[]; __iconforge?: string }
}

const SIZE = 1024
const TAU = Math.PI * 2

/* ── deterministic noise ─────────────────────────────────────────────────── */
let seedState = 0x2f6b11c7
const rnd = () => { seedState ^= seedState << 13; seedState ^= seedState >>> 17; seedState ^= seedState << 5; return (seedState >>> 0) / 4294967296 }
const hash2 = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mix3 = (a: number[], b: number[], t: number) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  return mix(mix(hash2(ix, iy), hash2(ix + 1, iy), ux), mix(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), ux), uy)
}
function fbm(x: number, y: number, oct = 4) {
  let v = 0, amp = 0.5, f = 1
  for (let i = 0; i < oct; i++) { v += vnoise(x * f, y * f) * amp; f *= 2; amp *= 0.5 }
  return v
}

/* ── procedural texture maps (albedo + height→normal + roughness) ────────── */
const newCanvas = (size: number) => { const c = document.createElement('canvas'); c.width = c.height = size; return c }
const tex = (c: HTMLCanvasElement, srgb = false) => {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}
const gray = (v: number) => Math.round(clamp01(v) * 255)

function normalFromHeight(h: HTMLCanvasElement, strength: number) {
  const S = h.width
  const src = h.getContext('2d')!.getImageData(0, 0, S, S).data
  const out = newCanvas(S)
  const octx = out.getContext('2d')!
  const img = octx.createImageData(S, S)
  const at = (x: number, y: number) => src[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength
    const len = Math.hypot(dx, dy, 1)
    const i = (y * S + x) * 4
    img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
    img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
    img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
    img.data[i + 3] = 255
  }
  octx.putImageData(img, 0, 0)
  return out
}

type Maps = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }

function pixelMaps(S: number, shade: (u: number, v: number, x: number, y: number) => [number[], number, number]) {
  const alb = newCanvas(S), hgt = newCanvas(S), rgh = newCanvas(S)
  const actx = alb.getContext('2d')!, hctx = hgt.getContext('2d')!, rctx = rgh.getContext('2d')!
  const A = actx.createImageData(S, S), H = hctx.createImageData(S, S), R = rctx.createImageData(S, S)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const [col, h, r] = shade(x / S, y / S, x, y)
    const i = (y * S + x) * 4
    A.data[i] = col[0]; A.data[i + 1] = col[1]; A.data[i + 2] = col[2]; A.data[i + 3] = 255
    const g = gray(h); H.data[i] = H.data[i + 1] = H.data[i + 2] = g; H.data[i + 3] = 255
    const q = gray(r); R.data[i] = R.data[i + 1] = R.data[i + 2] = q; R.data[i + 3] = 255
  }
  actx.putImageData(A, 0, 0); hctx.putImageData(H, 0, 0); rctx.putImageData(R, 0, 0)
  return { alb, hgt, rgh }
}
/** Paint the same feature into albedo / height / roughness so all three maps agree. */
function stroke3(m: { alb: HTMLCanvasElement; hgt: HTMLCanvasElement; rgh: HTMLCanvasElement }, w: number, colA: string, colH: string, colR: string, path: (ctx: CanvasRenderingContext2D) => void) {
  for (const [key, col] of [['alb', colA], ['hgt', colH], ['rgh', colR]] as const) {
    const ctx = m[key].getContext('2d')!
    ctx.lineWidth = w
    ctx.strokeStyle = col
    ctx.beginPath()
    path(ctx)
    ctx.stroke()
  }
}
function fill3(m: { alb: HTMLCanvasElement; hgt: HTMLCanvasElement; rgh: HTMLCanvasElement }, colA: string, colH: string, colR: string, shape: (ctx: CanvasRenderingContext2D) => void) {
  for (const [key, col] of [['alb', colA], ['hgt', colH], ['rgh', colR]] as const) {
    const ctx = m[key].getContext('2d')!
    ctx.fillStyle = col
    ctx.beginPath()
    shape(ctx)
    ctx.fill()
  }
}
const finish = (S: number, m: { alb: HTMLCanvasElement; hgt: HTMLCanvasElement; rgh: HTMLCanvasElement }, normalStrength: number): Maps => ({
  map: tex(m.alb, true),
  normalMap: tex(normalFromHeight(m.hgt, normalStrength)),
  roughnessMap: tex(m.rgh),
})

function woodMaps(): Maps {
  const S = 512
  const dark = [46, 32, 21], base = [94, 66, 43], light = [146, 108, 70]
  const m = pixelMaps(S, (u, v, x, y) => {
    const warp = fbm(u * 2.4, v * 0.9, 4) * 2.6
    const rings = Math.sin((u * 18 + warp + Math.sin(v * 3.1) * 0.35) * TAU)
    const fine = fbm(u * 44, v * 9, 3)
    const speck = 1 + (hash2(x, y) - 0.5) * 0.1
    const t = clamp01(0.5 + rings * 0.16 + (fine - 0.5) * 0.34)
    const col = (t < 0.5 ? mix3(dark, base, t * 2) : mix3(base, light, (t - 0.5) * 2)).map(c => c * speck)
    return [col, 0.5 + rings * 0.22 + (fine - 0.5) * 0.5, 0.74 + rings * 0.06 + (fine - 0.5) * 0.16]
  })
  for (let k = 0; k < 9; k++) {
    const x0 = rnd() * S, drift = (rnd() - 0.5) * 80, w = 1.2 + rnd() * 2.4
    stroke3(m, w, 'rgba(30,17,9,0.85)', '#141414', '#e8e8e8', ctx => {
      for (let s = 0; s <= 26; s++) {
        const t = s / 26, x = x0 + drift * t + Math.sin(t * 8 + k) * 7, y = t * S
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
    })
  }
  for (let k = 0; k < 28; k++) {
    const x = rnd() * S, y = rnd() * S, r = 4 + rnd() * 13, rot = rnd() * TAU
    fill3(m, 'rgba(28,15,8,0.32)', '#2a2a2a', '#d2d2d2', ctx => ctx.ellipse(x, y, r, r * 0.5, rot, 0, TAU))
  }
  return finish(S, m, 1.6)
}

type MetalOpts = { dark: number[]; mid: number[]; light: number[]; bands: number; scratch: number; pit: number; rough: [number, number] }
function metalMaps(o: MetalOpts): Maps {
  const S = 512
  const m = pixelMaps(S, (u, v, x, y) => {
    const n1 = fbm(u * 5, v * 5, 4)
    const n2 = fbm(u * 26, v * 26, 3)
    const band = Math.sin((u * o.bands + n1 * 2.6) * TAU) * Math.sin((v * (o.bands * 0.6) + n2 * 1.6) * TAU)
    const t = clamp01(0.5 + band * 0.22 + (n1 - 0.5) * 0.3 + (n2 - 0.5) * 0.08)
    const col = (t < 0.5 ? mix3(o.dark, o.mid, t * 2) : mix3(o.mid, o.light, (t - 0.5) * 2)).map(c => c * (1 + (hash2(x, y) - 0.5) * 0.06))
    return [col, 0.5 + band * 0.16 + (n2 - 0.5) * 0.4, mix(o.rough[0], o.rough[1], 1 - t) + (n2 - 0.5) * 0.08]
  })
  for (let k = 0; k < o.scratch; k++) {
    const x = rnd() * S, y = rnd() * S, a = (rnd() - 0.5) * 1.1 + (rnd() < 0.5 ? 0 : Math.PI / 2), len = 14 + rnd() * 92
    const bright = rnd() < 0.55
    stroke3(m, 0.6 + rnd() * 1.2,
      bright ? 'rgba(220,232,246,0.20)' : 'rgba(8,9,12,0.26)',
      bright ? '#e4e4e4' : '#242424',
      bright ? '#a4a4a4' : '#6c6c6c',
      ctx => { ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len) })
  }
  for (let k = 0; k < o.pit; k++) {
    const x = rnd() * S, y = rnd() * S, r = 1 + rnd() * 4
    fill3(m, 'rgba(8,9,12,0.5)', '#101010', '#f0f0f0', ctx => ctx.arc(x, y, r, 0, TAU))
  }
  return finish(S, m, 1.7)
}

function leatherMaps(): Maps {
  const S = 512
  const dark = [48, 28, 16], base = [100, 60, 34], light = [152, 100, 58]
  const m = pixelMaps(S, (u, v, x, y) => {
    const cell = fbm(u * 22, v * 22, 4)
    const crease = Math.sin((u * 6 + fbm(u * 3, v * 3, 3) * 2.2) * TAU) * 0.5 + 0.5
    const t = clamp01(0.45 + (cell - 0.5) * 0.75 + (crease - 0.5) * 0.2)
    const col = (t < 0.5 ? mix3(dark, base, t * 2) : mix3(base, light, (t - 0.5) * 2)).map(c => c * (1 + (hash2(x, y) - 0.5) * 0.16))
    return [col, 0.45 + (cell - 0.5) * 0.9 + (crease - 0.5) * 0.25, 0.64 + (cell - 0.5) * 0.22]
  })
  for (let k = 0; k < 16; k++) {
    const x = rnd() * S, y = rnd() * S, len = 30 + rnd() * 90, bend = (rnd() - 0.5) * 40
    stroke3(m, 1 + rnd() * 1.6, 'rgba(30,16,8,0.4)', '#1e1e1e', '#dcdcdc',
      ctx => { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend, y + len * 0.5, x + bend * 0.4, y + len) })
  }
  return finish(S, m, 2.0)
}

const ENV = (() => {
  const W = 1024, H = 512
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  const gr = ctx.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, '#3d3f4b'); gr.addColorStop(0.45, '#1d1e26'); gr.addColorStop(0.72, '#111217'); gr.addColorStop(1, '#0a0a0e')
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)
  const soft = (x: number, y: number, w: number, h: number, col: string, alpha: number) => {
    ctx.save(); ctx.filter = 'blur(30px)'; ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fillRect(x, y, w, h); ctx.restore()
  }
  soft(W * 0.12, H * 0.12, 260, 160, '#ffe2b4', 0.95)
  soft(W * 0.64, H * 0.06, 220, 140, '#c2dcff', 0.72)
  soft(W * 0.40, H * 0.58, 340, 140, '#8f5628', 0.42)
  return c
})()

/* ── renderer + shared materials ─────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(SIZE, SIZE, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setClearColor(0x000000, 0)

const pmrem = new THREE.PMREMGenerator(renderer)
const envTex = new THREE.CanvasTexture(ENV)
envTex.mapping = THREE.EquirectangularReflectionMapping
envTex.colorSpace = THREE.SRGBColorSpace
const ENV_MAP = pmrem.fromEquirectangular(envTex).texture
envTex.dispose(); pmrem.dispose()

const std = (maps: Maps, o: Partial<THREE.MeshStandardMaterialParameters>) => new THREE.MeshStandardMaterial({
  map: maps.map, normalMap: maps.normalMap, roughnessMap: maps.roughnessMap, roughness: 1, ...o,
})
const M = {
  wood: std(woodMaps(), { metalness: 0, envMapIntensity: 0.5, normalScale: new THREE.Vector2(0.7, 0.7) }),
  iron: std(metalMaps({ dark: [54, 58, 66], mid: [104, 112, 124], light: [172, 182, 196], bands: 5, scratch: 200, pit: 26, rough: [0.24, 0.48] }), { metalness: 0.94, envMapIntensity: 1.25 }),
  steel: std(metalMaps({ dark: [152, 164, 180], mid: [206, 218, 232], light: [250, 252, 255], bands: 3, scratch: 300, pit: 10, rough: [0.08, 0.26] }), { metalness: 1, envMapIntensity: 1.45 }),
  leather: std(leatherMaps(), { metalness: 0.02, envMapIntensity: 0.45, normalScale: new THREE.Vector2(1.0, 1.0) }),
  brass: std(metalMaps({ dark: [86, 62, 26], mid: [162, 124, 56], light: [228, 190, 112], bands: 4, scratch: 140, pit: 24, rough: [0.22, 0.46] }), { metalness: 0.9, envMapIntensity: 1.3 }),
  stone: std(metalMaps({ dark: [56, 54, 50], mid: [98, 94, 88], light: [152, 148, 140], bands: 6, scratch: 120, pit: 80, rough: [0.5, 0.78] }), { metalness: 0.04, envMapIntensity: 0.6 }),
  obsidian: std(metalMaps({ dark: [12, 12, 17], mid: [28, 28, 37], light: [72, 74, 92], bands: 4, scratch: 240, pit: 18, rough: [0.1, 0.28] }), { metalness: 0.18, envMapIntensity: 1.35 }),
  bone: std(metalMaps({ dark: [116, 102, 80], mid: [180, 166, 138], light: [230, 220, 196], bands: 5, scratch: 130, pit: 36, rough: [0.44, 0.7] }), { metalness: 0.05, envMapIntensity: 0.7 }),
  cord: std(leatherMaps(), { metalness: 0, envMapIntensity: 0.3, color: '#9a7a4c' }),
  amber: new THREE.MeshStandardMaterial({ color: '#f0b054', emissive: new THREE.Color('#c8681a'), emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.08, envMapIntensity: 1.3 }),
  ember: new THREE.MeshStandardMaterial({ color: '#ff9a4a', emissive: new THREE.Color('#ff6a18'), emissiveIntensity: 2.6, roughness: 0.5, metalness: 0, toneMapped: false }),
}
// Open-ended cylinders need double-sided faces; clones keep the shared materials single-sided.
const open = (src: THREE.MeshStandardMaterial) => {
  const c = src.clone()
  c.side = THREE.DoubleSide
  return c
}
const M_OPEN = { iron: open(M.iron), leather: open(M.leather) }
const GLOW = (() => {
  const c = newCanvas(128); const ctx = c.getContext('2d')!
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,200,138,1)'); gr.addColorStop(0.35, 'rgba(255,146,66,0.55)'); gr.addColorStop(1, 'rgba(255,110,40,0)')
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
})()

/* ── geometry helpers ────────────────────────────────────────────────────── */
function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], pos?: [number, number, number]) {
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true; m.receiveShadow = true
  if (pos) m.position.set(...pos)
  parent.add(m)
  return m
}
function ring(parent: THREE.Object3D, x: number, y: number, z: number, r: number, tube: number, mat: THREE.Material) {
  const m = addMesh(parent, new THREE.TorusGeometry(r, tube, 8, 30), mat, [x, y, z])
  m.rotation.x = Math.PI / 2
  return m
}
function rivets(parent: THREE.Object3D, y: number, r: number, n: number, size: number, mat: THREE.Material, phase = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + phase
    addMesh(parent, new THREE.SphereGeometry(size, 12, 8), mat, [Math.cos(a) * r, y, Math.sin(a) * r])
  }
}
function tubeFromCurve(curve: THREE.CatmullRomCurve3, radiusAt: (t: number) => number, radial = 18, seg = 80, wobble = 0.05) {
  const frames = curve.computeFrenetFrames(seg, false)
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t)
    const N = frames.normals[i], B = frames.binormals[i]
    const r = radiusAt(t) * (1 + wobble * (vnoise(t * 26, 4.3) - 0.5) * 2)
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU, ca = Math.cos(a), sa = Math.sin(a)
      const rr = r * (1 + 0.05 * Math.cos(2 * a))
      pos.push(p.x + (N.x * ca + B.x * sa) * rr, p.y + (N.y * ca + B.y * sa) * rr, p.z + (N.z * ca + B.z * sa) * rr)
      uv.push(j / radial, t * 3)
    }
  }
  const stride = radial + 1
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setIndex(idx)
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}
function wrapHelix(curve: THREE.CatmullRomCurve3, t0: number, t1: number, turns: number, tubeR: number, radiusAt: (t: number) => number) {
  const N = Math.max(28, Math.round(turns * 24))
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= N; i++) {
    const t = t0 + (t1 - t0) * (i / N), c = curve.getPointAt(t)
    const a = (i / N) * turns * TAU, r = radiusAt(t) + tubeR * 0.5
    pts.push(new THREE.Vector3(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, tubeR, 8, false)
}
function displaceGeo(geo: THREE.BufferGeometry, amp: number, freq: number) {
  const p = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const s = 1 + (fbm(x * freq + 11.3, y * freq + z * freq, 3) - 0.5) * amp * 2
    p.setXYZ(i, x * s, y, z * s)
  }
  p.needsUpdate = true
  geo.computeVertexNormals()
}
/** Leather grip: a sleeve with spiral wrap ridges on top, bound at both ends. */
function grip(parent: THREE.Object3D, curve: THREE.CatmullRomCurve3, radiusAt: (t: number) => number, t0: number, t1: number) {
  const sleevePts = curve.getPoints(24)
  const span = new THREE.CatmullRomCurve3(sleevePts.filter((_, i) => {
    const t = i / 24; return t >= t0 - 0.02 && t <= t1 + 0.02
  }))
  addMesh(parent, tubeFromCurve(span, t => radiusAt(t0 + (t1 - t0) * t) + 0.016, 16, 30, 0.02), M.leather)
  addMesh(parent, wrapHelix(curve, t0, t1, 8, 0.014, t => radiusAt(t) + 0.016), M.leather)
  for (const t of [t0, t1]) {
    const p = curve.getPointAt(t)
    ring(parent, p.x, p.y, p.z, radiusAt(t) + 0.032, 0.016, M.leather)
  }
}
/* ── the four weapons ────────────────────────────────────────────────────── */
function buildClub() {
  const g = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.10, 0), new THREE.Vector3(0.04, -0.60, 0.02),
    new THREE.Vector3(-0.03, -0.10, -0.03), new THREE.Vector3(0.03, 0.34, 0.02), new THREE.Vector3(0, 0.62, 0),
  ])
  const radiusAt = (t: number) => 0.056 + 0.034 * t + 0.012 * Math.sin(t * 7.5)
  addMesh(g, tubeFromCurve(curve, radiusAt, 20, 90, 0.05), M.wood)
  addMesh(g, new THREE.SphereGeometry(0.070, 20, 12), M.wood, [0, -1.10, 0])
  ring(g, 0, -1.03, 0, 0.074, 0.016, M.iron)
  rivets(g, -1.03, 0.074, 6, 0.012, M.steel)
  grip(g, curve, radiusAt, 0.07, 0.46)

  const headGeo = new THREE.LatheGeometry([[0.085, 0], [0.16, 0.06], [0.225, 0.16], [0.245, 0.30], [0.215, 0.44], [0.15, 0.55], [0.06, 0.62]].map(([r, y]) => new THREE.Vector2(r, y)), 22)
  displaceGeo(headGeo, 0.055, 2.6)
  addMesh(g, headGeo, M.wood, [0, 0.52, 0])
  for (const [a, y, s] of [[0.5, 0.70, 0.062], [2.3, 0.90, 0.056], [4.1, 0.62, 0.05], [5.4, 1.00, 0.042]]) {
    addMesh(g, new THREE.IcosahedronGeometry(1, 1), M.wood, [Math.cos(a) * 0.215, y, Math.sin(a) * 0.215]).scale.setScalar(s)
  }
  addMesh(g, new THREE.CylinderGeometry(0.168, 0.148, 0.20, 22, 1, true), M_OPEN.iron, [0, 0.60, 0])
  ring(g, 0, 0.700, 0, 0.168, 0.014, M.brass)
  ring(g, 0, 0.500, 0, 0.150, 0.014, M.brass)
  rivets(g, 0.60, 0.172, 6, 0.024, M.steel, 0.3)
  const capGeo = new THREE.SphereGeometry(0.152, 20, 12, 0, TAU, 0, Math.PI * 0.46)
  displaceGeo(capGeo, 0.03, 4)
  addMesh(g, capGeo, M.iron, [0, 1.06, 0])
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4
    const spike = addMesh(g, new THREE.ConeGeometry(0.045, 0.20, 10), M.steel, [Math.cos(a) * 0.235, 0.86, Math.sin(a) * 0.235])
    spike.rotation.z = -Math.cos(a) * 1.35
    spike.rotation.x = Math.sin(a) * 1.35
  }
  return g
}

/** Beveled extrusion used for axe / pick / spear heads. */
function headMesh(shape: THREE.Shape, depth: number, bevel: number, y: number, mats: THREE.Material[] = [M.iron, M.steel], x = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2, curveSegments: 18, steps: 1 })
  geo.translate(0, 0, -depth / 2)
  geo.computeVertexNormals()
  return addMesh(new THREE.Group(), geo, mats, [x, y, 0])
}
/** A cone driven into a rounded body, pointing along `dir`. */
function spike(parent: THREE.Object3D, center: THREE.Vector3, dir: [number, number, number], r: number, len: number, mat: THREE.Material) {
  const d = new THREE.Vector3(...dir).normalize()
  const m = addMesh(parent, new THREE.ConeGeometry(r, len, 9), mat, center.clone().addScaledVector(d, len * 0.3))
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)
  return m
}
/** Shared heavy haft for the maul family: bent wood, leather grip, brass ferrule. */
function heavyHaft(g: THREE.Group, top: number, r0 = 0.062, r1 = 0.084) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.02, 0), new THREE.Vector3(0.03, -0.55, 0.015),
    new THREE.Vector3(-0.02, -0.05, -0.02), new THREE.Vector3(0.02, 0.30, 0.01), new THREE.Vector3(0, top, 0),
  ])
  const radiusAt = (t: number) => r0 + (r1 - r0) * t
  addMesh(g, tubeFromCurve(curve, radiusAt, 18, 80, 0.045), M.wood)
  addMesh(g, new THREE.SphereGeometry(r0 * 1.05, 16, 10), M.wood, [0, -1.02, 0])
  ring(g, 0, -0.96, 0, r0 * 1.16, 0.016, M.brass)
  grip(g, curve, radiusAt, 0.05, 0.42)
  return curve
}

function buildAxe() {
  const g = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.98, 0), new THREE.Vector3(0.035, -0.50, 0.015),
    new THREE.Vector3(-0.02, 0.0, -0.02), new THREE.Vector3(0.025, 0.40, 0.01), new THREE.Vector3(0, 0.62, 0),
  ])
  const radiusAt = (t: number) => 0.052 + 0.016 * t
  addMesh(g, tubeFromCurve(curve, radiusAt, 18, 80, 0.04), M.wood)
  addMesh(g, new THREE.SphereGeometry(0.058, 18, 10), M.wood, [0, -0.98, 0])
  ring(g, 0, -0.92, 0, 0.062, 0.015, M.brass)
  grip(g, curve, radiusAt, 0.05, 0.42)

  const s = new THREE.Shape()
  s.moveTo(-0.14, -0.18)
  s.lineTo(0.03, -0.22)
  s.quadraticCurveTo(0.30, -0.26, 0.44, -0.52)
  s.quadraticCurveTo(0.62, -0.38, 0.68, -0.12)
  s.lineTo(0.64, 0.00)
  s.lineTo(0.70, 0.11)
  s.quadraticCurveTo(0.62, 0.31, 0.44, 0.41)
  s.quadraticCurveTo(0.24, 0.47, 0.10, 0.30)
  s.lineTo(0.03, 0.22)
  s.lineTo(-0.14, 0.18)
  s.closePath()
  const head = headMesh(s, 0.13, 0.026, 0.46)
  head.scale.setScalar(1.14)
  g.add(head)
  addMesh(g, new RoundedBoxGeometry(0.19, 0.30, 0.19, 3, 0.035), M.iron, [-0.19, 0.46, 0])
  addMesh(g, new THREE.CylinderGeometry(0.112, 0.100, 0.50, 20, 1, true), M_OPEN.iron, [0, 0.46, 0])
  ring(g, 0, 0.70, 0, 0.112, 0.014, M.brass)
  ring(g, 0, 0.24, 0, 0.104, 0.014, M.brass)
  rivets(g, 0.60, 0.115, 5, 0.020, M.steel, 0.4)
  addMesh(g, new THREE.CylinderGeometry(0.036, 0.054, 0.13, 10), M.wood, [0, 0.72, 0])
  addMesh(g, new THREE.CylinderGeometry(0.056, 0.056, 0.03, 12), M.brass, [0, 0.79, 0])
  return g
}

function buildPick() {
  const g = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.96, 0), new THREE.Vector3(0.03, -0.48, 0.012),
    new THREE.Vector3(-0.022, 0.04, -0.016), new THREE.Vector3(0.018, 0.46, 0), new THREE.Vector3(0, 0.66, 0),
  ])
  const radiusAt = (t: number) => 0.054 + 0.014 * t
  addMesh(g, tubeFromCurve(curve, radiusAt, 18, 80, 0.045), M.wood)
  addMesh(g, new THREE.SphereGeometry(0.060, 18, 10), M.wood, [0, -0.96, 0])
  ring(g, 0, -0.90, 0, 0.064, 0.015, M.iron)
  grip(g, curve, radiusAt, 0.05, 0.40)

  const s = new THREE.Shape()
  s.moveTo(-0.84, 0.06)
  s.quadraticCurveTo(-0.52, 0.30, -0.18, 0.40)
  s.lineTo(0.18, 0.40)
  s.quadraticCurveTo(0.52, 0.30, 0.84, 0.06)
  s.quadraticCurveTo(0.54, 0.16, 0.20, 0.18)
  s.lineTo(-0.20, 0.18)
  s.quadraticCurveTo(-0.54, 0.16, -0.84, 0.06)
  s.closePath()
  g.add(headMesh(s, 0.20, 0.036, 0.56))
  for (const side of [-1, 1]) {
    const tip = addMesh(g, new THREE.ConeGeometry(0.055, 0.28, 12), M.steel, [side * 0.96, 0.10 + 0.56, 0])
    tip.rotation.z = side > 0 ? -Math.PI / 2 + 0.72 : Math.PI / 2 - 0.72
  }
  addMesh(g, new THREE.CylinderGeometry(0.104, 0.094, 0.30, 20, 1, true), M_OPEN.iron, [0, 0.60, 0])
  addMesh(g, new RoundedBoxGeometry(0.30, 0.26, 0.20, 3, 0.05), M.iron, [0, 0.66, 0])
  ring(g, 0, 0.74, 0, 0.104, 0.014, M.brass)
  rivets(g, 0.64, 0.108, 4, 0.019, M.steel, 0.7)
  addMesh(g, new THREE.CylinderGeometry(0.034, 0.050, 0.12, 10), M.wood, [0, 0.79, 0])
  return g
}

function buildFists() {
  const g = new THREE.Group()
  // forearm cuff dropping back-left from the palm (rings live in the cuff's own space)
  const cuffG = new THREE.Group()
  cuffG.position.set(-0.06, -0.50, -0.10)
  cuffG.rotation.set(0.26, 0.10, 0.20)
  g.add(cuffG)
  addMesh(cuffG, new THREE.CylinderGeometry(0.27, 0.35, 0.55, 24, 1, true), M_OPEN.leather, [0, -0.04, 0])
  ring(cuffG, 0, -0.31, 0, 0.35, 0.030, M.iron)
  ring(cuffG, 0, 0.12, 0, 0.285, 0.024, M.brass)
  rivets(cuffG, -0.31, 0.35, 8, 0.017, M.steel)

  // palm block
  addMesh(g, new RoundedBoxGeometry(0.74, 0.58, 0.56, 6, 0.14), M.leather, [0, 0, 0])
  // curled fingers: chunky proximal row folded down, iron knuckle caps on top
  for (let i = 0; i < 4; i++) {
    const x = -0.275 + i * 0.183
    addMesh(g, new RoundedBoxGeometry(0.185, 0.26, 0.24, 4, 0.07), M.leather, [x, 0.05, 0.30]).rotation.x = 0.85
    addMesh(g, new RoundedBoxGeometry(0.185, 0.15, 0.18, 3, 0.045), M.iron, [x, 0.30, 0.15]).rotation.x = -0.5
    addMesh(g, new THREE.SphereGeometry(0.022, 10, 8), M.steel, [x, 0.375, 0.175])
  }
  // thumb folded across the front
  addMesh(g, new RoundedBoxGeometry(0.21, 0.24, 0.22, 4, 0.07), M.leather, [0.42, -0.04, 0.16]).rotation.z = -0.9
  addMesh(g, new RoundedBoxGeometry(0.17, 0.13, 0.16, 3, 0.04), M.iron, [0.44, 0.12, 0.08]).rotation.z = -0.9

  // layered back guard carrying a restrained amber rune
  addMesh(g, new RoundedBoxGeometry(0.70, 0.18, 0.52, 4, 0.06), M.iron, [0, 0.22, -0.20]).rotation.x = -0.18
  addMesh(g, new RoundedBoxGeometry(0.44, 0.16, 0.34, 4, 0.05), M.iron, [0, 0.34, -0.26]).rotation.x = -0.18
  addMesh(g, new THREE.TorusGeometry(0.11, 0.016, 8, 28), M.ember, [0, 0.435, -0.28]).rotation.x = Math.PI / 2 - 0.18
  for (const dx of [-0.07, 0.07]) addMesh(g, new THREE.BoxGeometry(0.018, 0.016, 0.13), M.ember, [dx, 0.435, -0.28]).rotation.x = -0.18
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ff9a4a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.3 }))
  glow.scale.setScalar(0.5)
  glow.position.set(0, 0.46, -0.3)
  g.add(glow)
  // crossing straps + buckle
  for (const rot of [0.6, -0.6]) {
    addMesh(g, new THREE.TorusGeometry(0.38, 0.028, 8, 28, Math.PI * 1.2), M.leather, [0, 0, 0]).rotation.set(Math.PI / 2, rot, 0)
  }
  addMesh(g, new RoundedBoxGeometry(0.11, 0.09, 0.04, 2, 0.015), M.brass, [0, 0.02, 0.30])
  for (const [x, y, z, s] of [[0.04, 0.56, -0.34, 0.02], [-0.15, 0.44, -0.38, 0.014], [0.18, 0.38, -0.34, 0.012]]) {
    addMesh(g, new THREE.SphereGeometry(s, 10, 8), M.ember, [x, y, z])
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ff9a4a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.28 }))
    sp.scale.setScalar(s * 12)
    sp.position.set(x, y, z)
    g.add(sp)
  }
  return g
}

function buildMaul() {
  const g = new THREE.Group()
  heavyHaft(g, 0.58)
  const headGeo = new RoundedBoxGeometry(0.44, 0.36, 0.34, 4, 0.09)
  displaceGeo(headGeo, 0.12, 2.2)
  const head = addMesh(g, headGeo, M.stone, [0.05, 0.66, 0])
  head.rotation.z = 0.14
  const pollGeo = new RoundedBoxGeometry(0.17, 0.24, 0.2, 3, 0.05)
  displaceGeo(pollGeo, 0.1, 2.6)
  const poll = addMesh(g, pollGeo, M.stone, [-0.2, 0.64, 0])
  poll.rotation.z = -0.24
  for (const y of [0.55, 0.66, 0.77]) ring(g, 0.05, y, 0, 0.235, 0.021, M.cord)
  for (const [x, z] of [[0.05, 0.235], [0.05, -0.235], [-0.18, 0.16], [-0.18, -0.16]]) {
    addMesh(g, new THREE.SphereGeometry(0.022, 10, 8), M.iron, [x, 0.66, z])
  }
  addMesh(g, new THREE.CylinderGeometry(0.04, 0.058, 0.12, 10), M.bone, [0.02, 0.88, 0])
  return g
}

function buildAmberHammer() {
  const g = new THREE.Group()
  heavyHaft(g, 0.56, 0.058, 0.078)
  addMesh(g, new THREE.CylinderGeometry(0.10, 0.088, 0.16, 18), M.brass, [0, 0.60, 0])
  for (const side of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.07, 0.58, 0), new THREE.Vector3(side * 0.28, 0.74, 0.02),
      new THREE.Vector3(side * 0.38, 0.96, 0), new THREE.Vector3(side * 0.27, 1.15, -0.02),
    ])
    addMesh(g, tubeFromCurve(c, t => 0.058 * (1 - t * 0.88) + 0.007, 12, 44, 0.025), M.bone)
    addMesh(g, new THREE.SphereGeometry(0.064, 14, 10), M.bone, [side * 0.07, 0.58, 0])
  }
  const core = addMesh(g, new THREE.OctahedronGeometry(0.17, 0), M.amber, [0, 0.86, 0])
  core.scale.set(0.85, 1.3, 0.85)
  core.rotation.y = 0.5
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ffae54', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.45 }))
  glow.scale.setScalar(0.66)
  glow.position.set(0, 0.86, 0)
  g.add(glow)
  for (const y of [0.74, 1.00]) ring(g, 0, y, 0, 0.14, 0.016, M.brass)
  return g
}

function buildObsidianClub() {
  const g = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.04, 0), new THREE.Vector3(0.03, -0.52, 0.015),
    new THREE.Vector3(-0.02, 0.02, -0.015), new THREE.Vector3(0.02, 0.44, 0.01), new THREE.Vector3(0, 0.78, 0),
  ])
  const radiusAt = (t: number) => 0.05 + 0.13 * Math.pow(t, 2.2)
  addMesh(g, tubeFromCurve(curve, radiusAt, 20, 88, 0.045), M.bone)
  addMesh(g, new THREE.SphereGeometry(0.056, 16, 10), M.bone, [0, -1.04, 0])
  ring(g, 0, -0.98, 0, 0.060, 0.016, M.iron)
  grip(g, curve, radiusAt, 0.03, 0.30)
  const knob = new THREE.Vector3(0, 0.80, 0)
  for (const dir of [[0.9, 0.25, 0.2], [-0.85, 0.3, 0.3], [0.35, 0.35, -0.9], [-0.3, 0.4, -0.85], [0.7, 0.7, -0.4], [-0.6, 0.75, -0.35], [0.1, 0.95, 0.3]]) {
    spike(g, knob, dir as [number, number, number], 0.05, 0.24, M.obsidian)
  }
  const crown = addMesh(g, new THREE.ConeGeometry(0.08, 0.32, 9), M.obsidian, [0, 1.06, 0])
  crown.rotation.z = 0.1
  ring(g, 0, 0.62, 0, 0.115, 0.019, M.iron)
  return g
}

function buildBoneSpear() {
  const g = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.06, 0), new THREE.Vector3(0.02, -0.42, 0.012),
    new THREE.Vector3(-0.016, 0.18, -0.01), new THREE.Vector3(0.006, 0.72, 0),
  ])
  const radiusAt = (t: number) => 0.034 + 0.014 * t
  addMesh(g, tubeFromCurve(curve, radiusAt, 14, 92, 0.028), M.bone)
  addMesh(g, new THREE.SphereGeometry(0.040, 14, 10), M.bone, [0, -1.06, 0])
  ring(g, 0, -1.0, 0, 0.044, 0.013, M.brass)
  grip(g, curve, radiusAt, 0.02, 0.24)
  const s = new THREE.Shape()
  s.moveTo(0, -0.03)
  s.quadraticCurveTo(0.105, 0.10, 0.078, 0.30)
  s.quadraticCurveTo(0.042, 0.44, 0, 0.54)
  s.quadraticCurveTo(-0.046, 0.43, -0.082, 0.29)
  s.quadraticCurveTo(-0.105, 0.09, 0, -0.03)
  s.closePath()
  g.add(headMesh(s, 0.055, 0.014, 0.74, [M.stone, M.steel]))
  for (const y of [0.72, 0.78, 0.84]) ring(g, 0, y, 0, 0.052, 0.014, M.cord)
  const base = new THREE.Vector3(0, 0.88, 0)
  spike(g, base, [0.85, -0.45, 0.15], 0.026, 0.16, M.stone)
  spike(g, base, [-0.85, -0.45, -0.15], 0.026, 0.16, M.stone)
  return g
}

function buildStalkerLance() {
  const g = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.05, 0), new THREE.Vector3(0.028, -0.45, 0.014),
    new THREE.Vector3(-0.02, 0.05, -0.012), new THREE.Vector3(0.012, 0.52, 0), new THREE.Vector3(0, 0.72, 0),
  ])
  const radiusAt = (t: number) => 0.042 + 0.012 * t
  addMesh(g, tubeFromCurve(curve, radiusAt, 16, 88, 0.035), M.wood)
  addMesh(g, new THREE.SphereGeometry(0.046, 14, 10), M.wood, [0, -1.05, 0])
  grip(g, curve, radiusAt, 0.03, 0.28)
  addMesh(g, new THREE.CylinderGeometry(0.058, 0.052, 0.07, 14), M.brass, [0, 0.70, 0])
  const claw = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(0.18, 0.88, 0.03),
    new THREE.Vector3(0.26, 1.14, 0), new THREE.Vector3(0.10, 1.34, -0.03),
  ])
  addMesh(g, tubeFromCurve(claw, t => 0.105 * (1 - t * 0.93) + 0.006, 16, 52, 0.02), M.bone)
  const claw2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.03, 0.64, 0.06), new THREE.Vector3(-0.16, 0.84, 0.11), new THREE.Vector3(-0.24, 1.04, 0.06),
  ])
  addMesh(g, tubeFromCurve(claw2, t => 0.065 * (1 - t * 0.9) + 0.005, 12, 36, 0.02), M.bone)
  for (const y of [0.70, 0.80, 0.90]) ring(g, 0.02, y, 0.01, 0.085, 0.016, M.cord)
  return g
}

/** Shared pouch + ammunition for the two slings. */
function slingPouch(g: THREE.Group, leather: THREE.Material) {
  addMesh(g, new RoundedBoxGeometry(0.30, 0.10, 0.26, 4, 0.045), leather, [0, 0, 0])
  addMesh(g, new THREE.SphereGeometry(0.085, 16, 12), M.stone, [0, 0.08, 0])
  for (const side of [-1, 1]) addMesh(g, new THREE.SphereGeometry(0.026, 10, 8), M.brass, [side * 0.145, 0.01, 0])
}

function buildReedSling() {
  const g = new THREE.Group()
  slingPouch(g, M.leather)
  for (const side of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.145, 0.02, 0), new THREE.Vector3(side * 0.25, 0.28, 0.02),
      new THREE.Vector3(side * 0.15, 0.54, 0), new THREE.Vector3(0, 0.64, 0),
    ])
    addMesh(g, tubeFromCurve(c, () => 0.023, 10, 48, 0.018), M.cord)
    addMesh(g, wrapHelix(c, 0, 1, 5, 0.008, () => 0.025), M.leather)
  }
  addMesh(g, new THREE.TorusGeometry(0.085, 0.021, 8, 26), M.cord, [0, 0.71, 0])
  addMesh(g, new RoundedBoxGeometry(0.10, 0.05, 0.09, 3, 0.02), M.leather, [0, 0.64, 0])
  return g
}

function buildSinewSling() {
  const g = new THREE.Group()
  slingPouch(g, M.leather)
  const bar = addMesh(g, new THREE.CylinderGeometry(0.046, 0.046, 0.44, 14), M.bone, [0, 0.54, 0])
  bar.rotation.z = Math.PI / 2
  for (const side of [-1, 1]) {
    addMesh(g, new THREE.SphereGeometry(0.056, 12, 10), M.bone, [side * 0.22, 0.54, 0])
    addMesh(g, new THREE.CylinderGeometry(0.052, 0.052, 0.05, 12), M.brass, [side * 0.17, 0.54, 0]).rotation.z = Math.PI / 2
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.20, 0.54, 0), new THREE.Vector3(side * 0.175, 0.30, 0.02), new THREE.Vector3(side * 0.14, 0.04, 0),
    ])
    addMesh(g, tubeFromCurve(c, () => 0.02, 10, 36, 0.014), M.cord)
  }
  addMesh(g, new THREE.CylinderGeometry(0.06, 0.06, 0.07, 14), M.brass, [0, 0.54, 0]).rotation.z = Math.PI / 2
  return g
}

/* ── scene assembly, framing, render ─────────────────────────────────────── */
const SPECS = [
  { name: 'weapon-club', build: buildClub, rot: [-0.12, 0.58, -0.62] as [number, number, number] },
  { name: 'weapon-hatchet', build: buildAxe, rot: [-0.10, 0.52, -0.55] as [number, number, number] },
  { name: 'weapon-pick', build: buildPick, rot: [-0.10, 0.56, -0.58] as [number, number, number] },
  { name: 'weapon-fists', build: buildFists, rot: [-0.14, -0.44, -0.16] as [number, number, number] },
  { name: 'weapon-maul', build: buildMaul, rot: [-0.10, 0.55, -0.50] as [number, number, number] },
  { name: 'weapon-amber-hammer', build: buildAmberHammer, rot: [-0.10, 0.38, -0.58] as [number, number, number] },
  { name: 'weapon-obsidian-club', build: buildObsidianClub, rot: [-0.10, 0.55, -0.66] as [number, number, number] },
  { name: 'weapon-bone-spear', build: buildBoneSpear, rot: [-0.08, 0.50, -0.62] as [number, number, number] },
  { name: 'weapon-stalker-lance', build: buildStalkerLance, rot: [-0.08, 0.50, -0.58] as [number, number, number] },
  { name: 'weapon-reed-sling', build: buildReedSling, rot: [-0.18, 0.22, -0.10] as [number, number, number] },
  { name: 'weapon-sinew-sling', build: buildSinewSling, rot: [-0.18, 0.22, -0.10] as [number, number, number] },
]

function makeScene() {
  const scene = new THREE.Scene()
  scene.environment = ENV_MAP
  scene.environmentIntensity = 1.0
  const key = new THREE.DirectionalLight('#ffe0b8', 4.6)
  key.position.set(3.2, 4.6, 3.4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0006
  key.shadow.normalBias = 0.02
  const rim = new THREE.DirectionalLight('#bcd8ff', 4.4); rim.position.set(-3.6, 1.8, -3.2)
  const fill = new THREE.DirectionalLight('#ff9a55', 1.1); fill.position.set(-1.6, -2.2, 2.6)
  scene.add(key, rim, fill, new THREE.AmbientLight('#ffffff', 0.16))
  return { scene, key }
}
/** Fit the rotated model to `fill` of the frame with a fixed 3/4 camera direction. */
function fit(holder: THREE.Object3D, cam: THREE.PerspectiveCamera, fill: number) {
  holder.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(holder)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const corners: THREE.Vector3[] = []
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z))
  const dir = new THREE.Vector3(0.10, 0.22, 1).normalize()
  let dist = (size.length() * 0.5) / Math.sin(THREE.MathUtils.degToRad(cam.fov * 0.5)) / fill
  for (let pass = 0; pass < 5; pass++) {
    cam.position.copy(center).addScaledVector(dir, dist)
    cam.lookAt(center)
    cam.updateMatrixWorld(true)
    let m = 0
    for (const c of corners) { const p = c.clone().project(cam); m = Math.max(m, Math.abs(p.x), Math.abs(p.y)) }
    dist *= m / fill
  }
  cam.position.copy(center).addScaledVector(dir, dist)
  cam.lookAt(center)
  cam.updateMatrixWorld(true)
  return { center, size }
}

const icons: IconOut[] = []
for (const spec of SPECS) {
  const { scene, key } = makeScene()
  const holder = new THREE.Group()
  holder.add(spec.build())
  holder.rotation.set(...spec.rot)
  scene.add(holder)
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 60)
  const { center, size } = fit(holder, cam, 0.95)
  key.position.copy(center).add(new THREE.Vector3(3.2, 4.6, 3.4))
  key.target.position.copy(center)
  scene.add(key.target)
  const rad = size.length() * 0.8
  Object.assign(key.shadow.camera, { left: -rad, right: rad, top: rad, bottom: -rad, near: 0.5, far: rad * 6 })
  key.shadow.camera.updateProjectionMatrix()
  renderer.render(scene, cam)
  icons.push({ name: spec.name, data: renderer.domElement.toDataURL('image/png') })
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose() })
}
window.__icons = icons
window.__iconNames = SPECS.map(s => s.name)
window.__iconforge = 'ready'