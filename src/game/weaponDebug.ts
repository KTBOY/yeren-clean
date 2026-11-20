import * as THREE from 'three'
import type { HunterAvatar } from './hunterModel'
import { attachmentFor } from './weaponAttach'

/**
 * Weapon-mount debug overlay (F9, off by default). Shows the mount bone, the weapon's local axes,
 * the weapon world bbox and an approximate torso collider, plus live sliders for the active
 * socket's position / rotation / scale. Never runs in normal play: update() early-outs when off.
 */
export class WeaponDebug {
  enabled = false
  private group = new THREE.Group()
  private axes = new THREE.AxesHelper(0.35)
  private weaponBox = new THREE.Box3Helper(new THREE.Box3(), 0xffb23e)
  private torsoBox = new THREE.Box3Helper(new THREE.Box3(), 0x7df9ff)
  private dots: THREE.Mesh[] = []
  private panel?: HTMLDivElement
  private sliders: { key: string; el: HTMLInputElement; out: HTMLOutputElement }[] = []
  private modeLabel?: HTMLElement

  constructor(private avatar: HunterAvatar, private scene: THREE.Scene) {
    this.group.visible = false
    this.group.add(this.weaponBox, this.torsoBox)
    const geo = new THREE.SphereGeometry(0.028, 8, 8)
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, depthTest: false })
    for (let i = 0; i < 6; i += 1) {
      const d = new THREE.Mesh(geo, mat)
      d.renderOrder = 999
      this.dots.push(d)
      this.group.add(d)
    }
    this.scene.add(this.group)
    window.addEventListener('keydown', e => {
      if (e.code === 'F9') { e.preventDefault(); this.toggle() }
    })
  }

  toggle(): void { this.enabled ? this.disable() : this.enable() }

  enable(): void {
    this.enabled = true
    this.group.visible = true
    this.avatar.weaponMount.add(this.axes)
    this.buildPanel()
    this.update()
  }

  disable(): void {
    this.enabled = false
    this.group.visible = false
    this.axes.removeFromParent()
    this.panel?.remove()
    this.panel = undefined
    this.sliders = []
  }

  /** Call once per frame from the game loop; no-op unless enabled. */
  update(): void {
    if (!this.enabled) return
    const av = this.avatar
    this.weaponBox.box.setFromObject(av.weaponMount)
    const hips = av.boneByName('Hips')
    const neck = av.boneByName('neck') ?? av.boneByName('Neck')
    if (hips && neck) {
      const a = hips.getWorldPosition(new THREE.Vector3())
      const b = neck.getWorldPosition(new THREE.Vector3())
      const c = a.clone().add(b).multiplyScalar(0.5)
      this.torsoBox.box.setFromCenterAndSize(c, new THREE.Vector3(0.42, a.distanceTo(b) + 0.24, 0.34))
    }
    const names = [attachmentFor(av.equippedId)[av.mountMode].bone, 'RightShoulder', 'LeftShoulder', 'RightArm', 'RightForeArm', 'RightHand']
    names.forEach((n, i) => {
      const bone = av.boneByName(n)
      const dot = this.dots[i]
      if (!bone || !dot) return
      bone.getWorldPosition(dot.position)
      dot.visible = true
    })
    if (this.modeLabel) this.modeLabel.textContent = `${av.mountMode} → ${attachmentFor(av.equippedId)[av.mountMode].bone}`
    for (const s of this.sliders) s.out.value = Number(s.el.value).toFixed(2)
  }

  private buildPanel(): void {
    const cfg = attachmentFor(this.avatar.equippedId)[this.avatar.mountMode]
    const p = document.createElement('div')
    p.style.cssText = 'position:fixed;top:12px;left:12px;z-index:9999;background:#140c06ee;border:1px solid #5a4028;border-radius:10px;padding:10px 12px;color:#fff4e0;font:12px/1.5 monospace;min-width:230px'
    p.innerHTML = '<b>Weapon mount debug (F9)</b><div data-mode style="color:#ffb23e"></div>'
    this.modeLabel = p.querySelector('[data-mode]')!
    const rows: [string, number, number, number, () => number, (v: number) => void][] = [
      ['pos.x', -0.6, 0.6, 0.01, () => cfg.position[0], v => { cfg.position[0] = v }],
      ['pos.y', -0.8, 0.6, 0.01, () => cfg.position[1], v => { cfg.position[1] = v }],
      ['pos.z', -0.6, 0.4, 0.01, () => cfg.position[2], v => { cfg.position[2] = v }],
      ['rot.x', -1.6, 1.6, 0.02, () => cfg.rotation[0], v => { cfg.rotation[0] = v }],
      ['rot.y', -1.6, 1.6, 0.02, () => cfg.rotation[1], v => { cfg.rotation[1] = v }],
      ['rot.z', -1.6, 1.6, 0.02, () => cfg.rotation[2], v => { cfg.rotation[2] = v }],
      ['scale', 0.4, 1.6, 0.02, () => cfg.scale, v => { cfg.scale = v }],
    ]
    for (const [key, min, max, step, get, set] of rows) {
      const line = document.createElement('label')
      line.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:4px'
      const el = document.createElement('input')
      el.type = 'range'; el.min = String(min); el.max = String(max); el.step = String(step); el.value = String(get())
      el.style.cssText = 'flex:1'
      const out = document.createElement('output')
      out.style.cssText = 'width:44px;text-align:right'
      out.value = get().toFixed(2)
      el.addEventListener('input', () => { set(Number(el.value)); this.avatar.refreshMount(); this.update() })
      line.append(key, el, out)
      p.append(line)
      this.sliders.push({ key, el, out })
    }
    document.body.append(p)
    this.panel = p
  }
}