import * as THREE from 'three'
import type { SceneryQuality } from '../scenery'

export type WeatherId = 'sunny' | 'cloudy' | 'storm' | 'sunset'

export interface WeatherPreset {
  /** Lit cumulus tops. */
  top: string
  /** Shadowed grey-blue bases. */
  bottom: string
  /** 0..1 sky coverage; drives mid instance count and far-layer density. */
  density: number
  /** Multiplier on the base horizontal drift speed. */
  speed: number
  /** Tint multiplied into the region sun colour. */
  sunTint: string
  sunMul: number
  hemiMul: number
  /** Colour the sky gradient is pulled toward, and how far. */
  skyTint: string
  skyAmt: number
}

export const WEATHER: Record<WeatherId, WeatherPreset> = {
  sunny: { top: '#f7f9fc', bottom: '#8794a8', density: 0.38, speed: 1.0, sunTint: '#fff2dd', sunMul: 1.0, hemiMul: 1.0, skyTint: '#8fa3c0', skyAmt: 0.0 },
  cloudy: { top: '#c9ced6', bottom: '#7c8798', density: 0.72, speed: 1.3, sunTint: '#dfe4ea', sunMul: 0.78, hemiMul: 0.92, skyTint: '#8d97a6', skyAmt: 0.28 },
  storm: { top: '#717885', bottom: '#434955', density: 0.96, speed: 2.2, sunTint: '#9aa2b0', sunMul: 0.46, hemiMul: 0.72, skyTint: '#343b47', skyAmt: 0.55 },
  sunset: { top: '#ffd9b0', bottom: '#8a7a72', density: 0.52, speed: 0.8, sunTint: '#ff9a4a', sunMul: 0.92, hemiMul: 0.86, skyTint: '#ff8a4a', skyAmt: 0.34 },
}

export interface CloudQuality {
  /** Individual marching-cubes cumulus meshes. */
  near: number
  /** Instanced mid-layer puffs. */
  mid: number
  /** Marching-cubes field resolution. */
  res: number
}

export const CLOUD_QUALITY: Record<SceneryQuality, CloudQuality> = {
  low: { near: 2, mid: 26, res: 32 },
  medium: { near: 3, mid: 46, res: 40 },
  high: { near: 4, mid: 72, res: 52 },
}

/** Base horizontal drift (world units / second) at the reference altitude. */
export const DRIFT_BASE = 2.4
/** Altitude band of the cloud deck (kept well above the highest peak). */
export const DECK = { min: 170, max: 250 }
/** Half-extent of the world-fixed drift volume; clouds wrap inside it. */
export const DRIFT_HALF = 760

export const col = (hex: string) => new THREE.Color(hex)