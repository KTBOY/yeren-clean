import * as THREE from 'three'
import { clamp, rng, smoothstep } from '../noise'
import type { SceneryQuality } from '../scenery'
import { CLOUD_QUALITY, DECK, DRIFT_BASE, DRIFT_HALF, WEATHER } from './config'
import { bakeCumulus, disposeCloudCache } from './geometry'
import { cloudMaterial } from './material'
import type { CloudWeatherState } from './weather'

const SPAN = DRIFT_HALF * 2
/** Wrap a coordinate into the world-fixed drift volume [-DRIFT_HALF, DRIFT_HALF]. */
const wrap = (v: number): number => (((v + DRIFT_HALF) % SPAN) + SPAN) % SPAN - DRIFT_HALF

interface NearData { baseX: number; baseZ: number; y: number; speed: number; phase: number }
interface MidData { baseX: number; baseZ: number; y: number; scale: number; rot: THREE.Quaternion; speed: number; thr: number }

/**
 * Hybrid cloud deck: a few detailed marching-cubes cumulus meshes up close, one InstancedMesh of
 * reused puffs for the mid field, and (in the sky shader) an FBM layer for the far horizon. The whole
 * volume is WORLD-FIXED and wraps around itself, so clouds drift past the player rather than following
 * the camera, and the sky stays continuous on every turn. Geometry/material are shared and cached;
 * the per-frame work is a handful of matrix composes with preallocated temps — no allocation.
 */
export class CloudSystem {
  readonly group = new THREE.Group()
  private readonly mat = cloudMaterial()
  private near: THREE.Mesh[] = []
  private nearData: NearData[] = []
  private mid?: THREE.InstancedMesh
  private midData: MidData[] = []
  private maxMid = 0
  private q: SceneryQuality
  private driftX = 0
  private driftZ = 0
  private readonly m4 = new THREE.Matrix4()
  private readonly v3 = new THREE.Vector3()
  private readonly s3 = new THREE.Vector3()

  constructor(quality: SceneryQuality) {
    this.q = quality
    this.build()
  }

  private build(): void {
    const cfg = CLOUD_QUALITY[this.q]
    const r = rng(7)

    // Near: individual hero cumulus, each a unique baked shape at the quality resolution.
    for (let i = 0; i < cfg.near; i += 1) {
      const a = r() * Math.PI * 2
      const d = 380 + r() * 300
      const baseX = Math.cos(a) * d
      const baseZ = Math.sin(a) * d
      const y = 190 + r() * 60
      const scale = 58 + r() * 34
      const geo = bakeCumulus(101 + i * 7, cfg.res)
      const mesh = new THREE.Mesh(geo, this.mat)
      mesh.position.set(baseX, y, baseZ)
      mesh.rotation.y = r() * Math.PI * 2
      mesh.scale.setScalar(scale)
      mesh.castShadow = false
      mesh.receiveShadow = false
      this.group.add(mesh)
      this.near.push(mesh)
      this.nearData.push({ baseX, baseZ, y, speed: 0.7 + r() * 0.5, phase: r() * Math.PI * 2 })
    }

    // Mid: one shared puff geometry + one shared material instanced across a seeded world ring.
    const midGeo = bakeCumulus(201, 30)
    this.maxMid = cfg.mid
    const mid = new THREE.InstancedMesh(midGeo, this.mat, this.maxMid)
    mid.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mid.frustumCulled = false
    mid.castShadow = false
    mid.receiveShadow = false
    for (let i = 0; i < this.maxMid; i += 1) {
      const a = r() * Math.PI * 2
      const d = 200 + Math.sqrt(r()) * 540
      const y = DECK.min + r() * (DECK.max - DECK.min)
      const hf = clamp((y - DECK.min) / (DECK.max - DECK.min), 0, 1)
      this.midData.push({
        baseX: Math.cos(a) * d, baseZ: Math.sin(a) * d, y,
        scale: 20 + r() * 26,
        rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * Math.PI * 2, 0)),
        speed: 0.6 + hf * 0.9,
        thr: r(),
      })
    }
    // Sort by appearance threshold so visible instances are a prefix: density can grow/shrink the
    // drawn count smoothly (the boundary instances scale in/out) without popping or rebuilding.
    this.midData.sort((p, q) => p.thr - q.thr)
    this.mid = mid
    this.group.add(mid)
    this.layoutMid(WEATHER.sunny.density)
  }

  private layoutMid(density: number): void {
    const mid = this.mid
    if (!mid) return
    const fade = 0.1
    let count = 0
    for (let i = 0; i < this.maxMid; i += 1) {
      const d = this.midData[i]
      const grow = smoothstep(d.thr - fade, d.thr + fade, density)
      if (grow <= 0.002) break
      const x = wrap(d.baseX + this.driftX * d.speed)
      const z = wrap(d.baseZ + this.driftZ * d.speed)
      const s = d.scale * grow
      this.m4.compose(this.v3.set(x, d.y, z), d.rot, this.s3.set(s, s * 0.66, s))
      mid.setMatrixAt(count, this.m4)
      count += 1
    }
    mid.count = count
    mid.instanceMatrix.needsUpdate = true
  }

  /** Live quality switch: rebuild the deck at the new resolution/count, releasing the old resources. */
  setQuality(q: SceneryQuality): void {
    if (q === this.q) return
    this.q = q
    this.clear()
    this.build()
  }

  update(dt: number, time: number, ws: CloudWeatherState): void {
    const wind = DRIFT_BASE * ws.speed
    this.driftX += wind * dt
    this.driftZ += wind * 0.25 * dt
    for (let i = 0; i < this.near.length; i += 1) {
      const d = this.nearData[i]
      const m = this.near[i]
      m.position.set(
        wrap(d.baseX + this.driftX * d.speed),
        d.y + Math.sin(time * 0.15 + d.phase) * 1.5,
        wrap(d.baseZ + this.driftZ * d.speed),
      )
    }
    this.layoutMid(ws.density)
  }

  private clear(): void {
    for (const m of this.near) this.group.remove(m)
    this.near = []
    this.nearData = []
    if (this.mid) {
      this.group.remove(this.mid)
      this.mid.dispose()
      this.mid = undefined
    }
    this.midData = []
    disposeCloudCache()
  }

  dispose(): void {
    this.clear()
    this.mat.dispose()
    this.group.removeFromParent()
  }
}