import * as THREE from 'three'
import { lerp } from '../noise'
import { WORLD_UNIFORMS } from '../materials'
import { WEATHER, col, type WeatherId, type WeatherPreset } from './config'

interface Resolved {
  top: THREE.Color; bottom: THREE.Color; sunTint: THREE.Color; skyTint: THREE.Color
  density: number; speed: number; sunMul: number; hemiMul: number; skyAmt: number
}
const resolve = (p: WeatherPreset): Resolved => ({
  top: col(p.top), bottom: col(p.bottom), sunTint: col(p.sunTint), skyTint: col(p.skyTint),
  density: p.density, speed: p.speed, sunMul: p.sunMul, hemiMul: p.hemiMul, skyAmt: p.skyAmt,
})
const RESOLVED: Record<WeatherId, Resolved> = {
  sunny: resolve(WEATHER.sunny), cloudy: resolve(WEATHER.cloudy), storm: resolve(WEATHER.storm), sunset: resolve(WEATHER.sunset),
}
const clone = (r: Resolved): Resolved => ({
  top: r.top.clone(), bottom: r.bottom.clone(), sunTint: r.sunTint.clone(), skyTint: r.skyTint.clone(),
  density: r.density, speed: r.speed, sunMul: r.sunMul, hemiMul: r.hemiMul, skyAmt: r.skyAmt,
})

/** The live, smoothly-blended weather state read by the cloud system and the scenery atmosphere. */
export type CloudWeatherState = Resolved

/**
 * Layers weather presets ON TOP of the region atmosphere (which Scenery keeps blending underneath).
 * Holds a preallocated current state and eases it toward the target preset every frame — no per-frame
 * allocation. Publishes the cloud colours/density into WORLD_UNIFORMS so the lit cloud material and
 * the far sky-shader layer stay in sync from a single source of truth.
 */
export class WeatherController {
  readonly state: CloudWeatherState = clone(RESOLVED.sunny)
  private target: Resolved = RESOLVED.sunny
  private id: WeatherId = 'sunny'
  /** Ease rate (1/seconds); ~95% settled in about 3.5s. */
  private readonly rate = 0.9

  constructor() {
    this.publish()
  }

  get current(): WeatherId {
    return this.id
  }

  set(id: WeatherId): void {
    if (id === this.id) return
    this.id = id
    this.target = RESOLVED[id]
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * this.rate)
    const s = this.state
    const t = this.target
    s.top.lerp(t.top, k)
    s.bottom.lerp(t.bottom, k)
    s.sunTint.lerp(t.sunTint, k)
    s.skyTint.lerp(t.skyTint, k)
    s.density = lerp(s.density, t.density, k)
    s.speed = lerp(s.speed, t.speed, k)
    s.sunMul = lerp(s.sunMul, t.sunMul, k)
    s.hemiMul = lerp(s.hemiMul, t.hemiMul, k)
    s.skyAmt = lerp(s.skyAmt, t.skyAmt, k)
    this.publish()
  }

  private publish(): void {
    WORLD_UNIFORMS.uCloudTop.value.copy(this.state.top)
    WORLD_UNIFORMS.uCloudBottom.value.copy(this.state.bottom)
    WORLD_UNIFORMS.uCloudSun.value.copy(this.state.sunTint)
    WORLD_UNIFORMS.uCloudDensity.value = this.state.density
  }
}