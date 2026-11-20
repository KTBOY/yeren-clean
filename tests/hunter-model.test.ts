import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applySocket, socketAxis, type SocketConfig } from '../src/game/weaponAttach'

function rig(handEuler: THREE.Euler) {
  const scene = new THREE.Scene()
  const model = new THREE.Group()
  model.scale.setScalar(0.02)
  model.quaternion.setFromEuler(new THREE.Euler(0.2, -0.4, 0.1))
  const hand = new THREE.Group()
  hand.position.set(8, 23, 2)
  hand.quaternion.setFromEuler(handEuler)
  model.add(hand)
  scene.add(model)
  scene.updateMatrixWorld(true)
  const rest = {
    quat: model.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion())),
    scale: hand.getWorldScale(new THREE.Vector3()).x,
  }
  const slot = new THREE.Group()
  return { scene, model, hand, slot, rest }
}

const cfg: SocketConfig = {
  bone: 'RightHand',
  position: [0, 0.02, 0.02],
  rotation: [0.7, 0, 0],
  scale: 1,
  collider: { radius: 0.06, halfLen: 0.5 },
}

describe('weapon socket', () => {
  it('places the grip at bone rest + model-local offset without inheriting rig scale', () => {
    const { scene, model, hand, slot, rest } = rig(new THREE.Euler(0.4, 0.1, -0.3))
    applySocket(slot, hand, cfg, rest)
    scene.updateMatrixWorld(true)
    const mq = model.getWorldQuaternion(new THREE.Quaternion())
    const want = hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...cfg.position).applyQuaternion(mq))
    expect(slot.getWorldPosition(new THREE.Vector3()).distanceTo(want)).toBeCloseTo(0, 5)
    expect(slot.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(1, 5)
    expect(slot.parent).toBe(hand)
  })

  it.each([
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(1.1, -0.7, 0.5),
  ])('keeps the configured carry axis across hand rest orientations', rotation => {
    const { scene, model, slot, rest, hand } = rig(rotation)
    applySocket(slot, hand, cfg, rest)
    scene.updateMatrixWorld(true)
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(slot.getWorldQuaternion(new THREE.Quaternion()))
    const want = socketAxis(cfg).applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()))
    expect(direction.distanceTo(want)).toBeCloseTo(0, 5)
  })

  it('keeps a back offset on the model back when the root yaws', () => {
    const { model, hand, slot, rest } = rig(new THREE.Euler(0, 0, 0))
    const backCfg: SocketConfig = { ...cfg, position: [0, 0, -0.2] }
    applySocket(slot, hand, backCfg, rest)
    model.quaternion.setFromEuler(new THREE.Euler(0, Math.PI, 0))
    model.updateMatrixWorld(true)
    const local = slot.getWorldPosition(new THREE.Vector3()).sub(hand.getWorldPosition(new THREE.Vector3()))
    local.applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion()).invert())
    expect(local.z).toBeCloseTo(-0.2, 5)
  })

  it('rides the bone when it animates away from rest', () => {
    const { scene, hand, slot, rest } = rig(new THREE.Euler(0, 0, 0))
    applySocket(slot, hand, cfg, rest)
    scene.updateMatrixWorld(true)
    const before = slot.getWorldPosition(new THREE.Vector3())
    hand.quaternion.setFromEuler(new THREE.Euler(0.6, 0, 0))
    hand.updateMatrixWorld(true)
    const after = slot.getWorldPosition(new THREE.Vector3())
    expect(after.distanceTo(before)).toBeGreaterThan(0.01)
  })
})