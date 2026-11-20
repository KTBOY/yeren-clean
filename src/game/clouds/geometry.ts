import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { rng } from '../noise'

/**
 * Cumulus geometries are baked ONCE from the official MarchingCubes implicit field and cached.
 * Nothing here runs per frame: the fused isosurface (smooth normals, no sphere seams) is sliced
 * out of the addon's dynamic buffers into a static, recentered BufferGeometry that meshes reuse.
 */
const cache = new Map<string, THREE.BufferGeometry>()

/**
 * Bake a single fluffy cumulus mound: a round-plan cluster of overlapping metaballs fuses into one
 * smooth body with smaller bumps on top for the cauliflower silhouette. Round plan (not a single
 * row) matters: a row viewed end-on collapses into a vertical stack of balls, while a cluster reads
 * as a wide mound from every horizontal angle. Wider than tall, centered on origin, spanning ~[-1,1].
 */
export function bakeCumulus(seed: number, res: number): THREE.BufferGeometry {
  const key = `${seed}:${res}`
  const hit = cache.get(key)
  if (hit) return hit

  const r = rng(seed)
  const dummy = new THREE.MeshBasicMaterial()
  const mc = new MarchingCubes(res, dummy, false, false, 16000)
  mc.isolation = 80
  mc.reset()
  const subtract = 12
  // Isosurface radius of a lone ball: sqrt(strength / (isolation + subtract)). Invert it so we can
  // place lobes at a chosen radius, then space them ~1.7 radii apart: close enough to fuse into one
  // surface, far enough that the field pinches between lobes and the silhouette stays cauliflower
  // (spacing << radius melts everything into a smooth egg that reads as rock/plastic).
  const S = (rad: number) => (80 + subtract) * rad * rad

  // Base tier: a ring of pinched lobes plus a core, fusing into a flat round belly.
  const n = 7
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.3
    const rr = 0.18 + (r() - 0.5) * 0.03
    const x = 0.5 + Math.cos(a) * rr
    const z = 0.5 + Math.sin(a) * rr
    const y = 0.4 + (r() - 0.5) * 0.04
    mc.addBall(x, y, z, S(0.08) * (0.9 + r() * 0.25), subtract)
  }
  mc.addBall(0.5, 0.4, 0.5, S(0.07), subtract)
  // Outlier lobes break the ring into an irregular, non-circular plan.
  for (let i = 0; i < 2; i += 1) {
    const a = r() * Math.PI * 2
    const rr = 0.2 + r() * 0.04
    mc.addBall(0.5 + Math.cos(a) * rr, 0.42 + r() * 0.03, 0.5 + Math.sin(a) * rr, S(0.07) * (0.85 + r() * 0.3), subtract)
  }
  // Crown tier: smaller lobes riding the belly, protruding into an irregular top.
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.5 + (r() - 0.5) * 0.3
    const rr = 0.11 + (r() - 0.5) * 0.03
    const x = 0.5 + Math.cos(a) * rr
    const z = 0.5 + Math.sin(a) * rr
    const y = 0.52 + (r() - 0.5) * 0.04
    mc.addBall(x, y, z, S(0.065) * (0.85 + r() * 0.3), subtract)
  }
  // Top knobs for a broken, fluffy skyline.
  for (let i = 0; i < 2; i += 1) {
    const x = 0.5 + (r() - 0.5) * 0.14
    const z = 0.5 + (r() - 0.5) * 0.14
    const y = 0.6 + r() * 0.03
    mc.addBall(x, y, z, S(0.05) * (0.8 + r() * 0.4), subtract)
  }
  mc.update()

  // Slice the live vertex range [0, count) into a static geometry (count is a vertex count).
  const count = mc.count
  const srcPos = mc.geometry.getAttribute('position').array as Float32Array
  const srcNor = mc.geometry.getAttribute('normal').array as Float32Array
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(srcPos.slice(0, count * 3), 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(srcNor.slice(0, count * 3), 3))
  geo.computeBoundingBox()
  const c = geo.boundingBox!.getCenter(new THREE.Vector3())
  geo.translate(-c.x, -c.y, -c.z)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()

  mc.geometry.dispose()
  dummy.dispose()
  cache.set(key, geo)
  return geo
}

/** Release every cached cloud geometry (called when the cloud system tears down). */
export function disposeCloudCache(): void {
  for (const g of cache.values()) g.dispose()
  cache.clear()
}