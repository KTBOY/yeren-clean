import * as THREE from 'three'

/**
 * Weapon attachment configuration. Every weapon declares two sockets (hand + back) so the avatar
 * can sheath it across the back during locomotion and draw it into the fist for combat/tasks.
 * Offsets are world-space metres relative to the mount bone's REST origin; rotations are world-space
 * Euler XYZ of the weapon's +Y (long) axis at rest. applySocket converts them into bone-local
 * transforms once (scale-compensated, no double parent rotation) so the weapon rigidly follows the
 * bone through every animation clip.
 */
export type MountMode = 'hand' | 'back'

export interface SocketConfig {
  bone: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  collider: { radius: number; halfLen: number }
}

export interface WeaponAttachmentConfig {
  hand: SocketConfig
  back: SocketConfig
}

/** Rest-pose reference of a mount bone, captured before any clip is applied. */
export interface BoneRest {
  quat: THREE.Quaternion
  scale: number
}

export const WEAPON_LEN: Record<string, number> = {
  club: 0.95, flintMaul: 1.1, amberHammer: 1.2, obsidianClub: 1.35, flintHatchet: 0.85,
  flintPick: 0.95, boneSpear: 1.75, stalkerLance: 1.9, reedSling: 0.75, sinewSling: 0.8, hands: 0.35,
}

const hand = (len: number): SocketConfig => ({
  bone: 'RightHand',
  position: [0, 0.02, 0.02],
  // Up-and-forward from the fist: in a combat stance the hand is ahead of the torso, so the shaft
  // rises away from the body instead of retracing the hanging arm (the old straight-up carry axis).
  rotation: [0.7, 0, 0],
  scale: 1,
  collider: { radius: 0.06, halfLen: len / 2 },
})

const back = (len: number, position: [number, number, number], rotation: [number, number, number], radius = 0.07): SocketConfig => ({
  bone: 'Spine01',
  position,
  rotation,
  scale: 1,
  collider: { radius, halfLen: len / 2 },
})

const L = WEAPON_LEN
export const WEAPON_ATTACH: Record<string, WeaponAttachmentConfig> = {
  club: { hand: hand(L.club), back: back(L.club, [-0.02, -0.26, -0.17], [-0.22, 0, 0.4]) },
  flintMaul: { hand: hand(L.flintMaul), back: back(L.flintMaul, [-0.02, -0.3, -0.18], [-0.22, 0, 0.4], 0.08) },
  amberHammer: { hand: hand(L.amberHammer), back: back(L.amberHammer, [-0.02, -0.3, -0.18], [-0.22, 0, 0.4], 0.08) },
  obsidianClub: { hand: hand(L.obsidianClub), back: back(L.obsidianClub, [-0.02, -0.33, -0.18], [-0.22, 0, 0.4], 0.08) },
  flintHatchet: { hand: hand(L.flintHatchet), back: back(L.flintHatchet, [-0.05, -0.2, -0.16], [0.4, 0, 0.5], 0.06) },
  flintPick: { hand: hand(L.flintPick), back: back(L.flintPick, [-0.05, -0.2, -0.16], [0.4, 0, 0.5], 0.06) },
  boneSpear: { hand: hand(L.boneSpear), back: back(L.boneSpear, [0, -0.31, -0.15], [-0.06, 0, 0.2], 0.05) },
  stalkerLance: { hand: hand(L.stalkerLance), back: back(L.stalkerLance, [0, -0.33, -0.15], [-0.06, 0, 0.2], 0.05) },
  reedSling: { hand: hand(L.reedSling), back: back(L.reedSling, [0.06, -0.3, -0.22], [0.05, 0, 0.15], 0.05) },
  sinewSling: { hand: hand(L.sinewSling), back: back(L.sinewSling, [0.06, -0.3, -0.22], [0.05, 0, 0.15], 0.05) },
}

const FALLBACK: WeaponAttachmentConfig = { hand: hand(1), back: back(1, [-0.02, -0.26, -0.17], [-0.22, 0, 0.4]) }

export function attachmentFor(id: string): WeaponAttachmentConfig {
  return WEAPON_ATTACH[id] ?? FALLBACK
}

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()

/**
 * Parent `slot` to `bone` and place it so that, at the bone's rest pose, the slot origin sits at
 * restPos+cfg.position and the weapon +Y points along cfg.rotation (world). Because the local
 * transform is derived from the REST reference (not the live pose), the socket is pose-independent
 * and simply rides the bone delta through idle/walk/run/swing. Scale is compensated once so the
 * weapon never inherits the rig's uniform scale twice.
 */
export function applySocket(slot: THREE.Group, bone: THREE.Object3D, cfg: SocketConfig, rest: BoneRest): void {
  if (slot.parent !== bone) bone.add(slot)
  const inv = _q.copy(rest.quat).invert()
  slot.position.set(cfg.position[0], cfg.position[1], cfg.position[2]).applyQuaternion(inv).divideScalar(rest.scale)
  slot.quaternion.copy(inv).multiply(_q.setFromEuler(_e.set(cfg.rotation[0], cfg.rotation[1], cfg.rotation[2], 'XYZ')))
  slot.scale.setScalar(cfg.scale / Math.max(1e-6, rest.scale))
}

/** World-space long axis of a socket config (unit vector). */
export function socketAxis(cfg: SocketConfig, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(0, 1, 0).applyQuaternion(_q.setFromEuler(_e.set(cfg.rotation[0], cfg.rotation[1], cfg.rotation[2], 'XYZ')))
}

/** Approximate world capsule centre of a mounted weapon, for debug/overlap checks. */
export function socketCenter(slot: THREE.Group, cfg: SocketConfig, out = new THREE.Vector3()): THREE.Vector3 {
  slot.updateWorldMatrix(true, false)
  // Grip sits ~12% up from the pommel; the body centre is a little further along +Y.
  out.set(0, cfg.collider.halfLen * 0.76, 0)
  return slot.localToWorld(out)
}