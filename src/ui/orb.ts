/**
 * Tribal status containers (health / stamina): obsidian-and-bone framed vessels
 * holding a living liquid, drawn on a per-orb 2D canvas.
 * Driven by the existing HUD frame loop — no second animation loop, no WebGL cost.
 */
export type OrbKind = 'health' | 'stamina'

type Palette = {
  emptyIn: string; emptyOut: string
  surface: string; top: string; mid: string; deep: string; bottom: string
  rim: string; spec: string; mote: string
  flash: string; pulse: string; lost: string
}

const PAL: Record<OrbKind, Palette> = {
  health: {
    emptyIn: '#2b0b09', emptyOut: '#0e0303',
    surface: '#e08a63', top: '#c4452c', mid: '#962015', deep: '#6b130c', bottom: '#3c0e08',
    rim: 'rgba(24, 4, 4, 0.62)', spec: 'rgba(255, 176, 132, 0.26)', mote: 'rgba(58, 12, 8, 0.5)',
    flash: 'rgba(96, 8, 6, 0.5)', pulse: 'rgba(168, 214, 140, ', lost: 'rgba(178, 92, 78, 0.34)',
  },
  stamina: {
    emptyIn: '#2b1d07', emptyOut: '#0f0902',
    surface: '#f2d795', top: '#d8ab4e', mid: '#b07f28', deep: '#8a5c17', bottom: '#4e320c',
    rim: 'rgba(28, 16, 3, 0.6)', spec: 'rgba(255, 226, 158, 0.24)', mote: 'rgba(255, 224, 150, 0.34)',
    flash: 'rgba(255, 196, 92, 0.34)', pulse: 'rgba(255, 202, 108, ', lost: 'rgba(180, 134, 66, 0.3)',
  },
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Shared grain texture, generated once and ref-counted across orbs. */
let noise: HTMLCanvasElement | null = null
let noiseUsers = 0
function grain(): HTMLCanvasElement {
  if (noise) return noise
  const c = document.createElement('canvas')
  c.width = c.height = 96
  const x = c.getContext('2d')!
  const img = x.createImageData(96, 96)
  const rnd = mulberry(0x5eed)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + rnd() * 90
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  x.putImageData(img, 0, 0)
  noise = c
  return c
}

/** Slightly irregular outer ring: hand-knapped obsidian, not a machined circle. */
function knappedRing(seed: number, r: number, jitter: number): string {
  const rnd = mulberry(seed)
  const n = 26
  let d = ''
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const rr = r + (rnd() - 0.5) * 2 * jitter
    const x = 60 + Math.cos(a) * rr
    const y = 60 + Math.sin(a) * rr
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return `${d}Z`
}

function tooth(cx: number, cy: number, ang: number, len: number, w: number): string {
  const dx = Math.cos(ang), dy = Math.sin(ang)
  const px = -dy, py = dx
  const tipX = cx + dx * len, tipY = cy + dy * len
  return `M${(cx + px * w).toFixed(1)} ${(cy + py * w).toFixed(1)}L${tipX.toFixed(1)} ${tipY.toFixed(1)}L${(cx - px * w).toFixed(1)} ${(cy - py * w).toFixed(1)}Z`
}

function frameSvg(kind: OrbKind, uid: string): string {
  const bone = `url(#${uid}-bone)`, wood = `url(#${uid}-wood)`, obs = `url(#${uid}-obs)`
  const defs = `<defs>
    <radialGradient id="${uid}-obs" cx="34%" cy="26%" r="88%">
      <stop offset="0" stop-color="#3a3733"/><stop offset=".45" stop-color="#191819"/><stop offset="1" stop-color="#070607"/>
    </radialGradient>
    <linearGradient id="${uid}-bone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d9cdb4"/><stop offset=".5" stop-color="#a8977c"/><stop offset="1" stop-color="#6b5c46"/>
    </linearGradient>
    <linearGradient id="${uid}-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6d4c2c"/><stop offset=".55" stop-color="#4a331d"/><stop offset="1" stop-color="#2c1e10"/>
    </linearGradient>
    <linearGradient id="${uid}-copper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b0764a"/><stop offset=".6" stop-color="#7c4a2a"/><stop offset="1" stop-color="#4e2d18"/>
    </linearGradient>
  </defs>`
  const ticks = (n: number, r0: number, r1: number, seed: number, col: string, w: number) => {
    const rnd = mulberry(seed)
    let s = ''
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + 0.13
      const len = r0 + rnd() * (r1 - r0)
      s += `<path d="M${(60 + Math.cos(a) * r0).toFixed(1)} ${(60 + Math.sin(a) * r0).toFixed(1)}L${(60 + Math.cos(a) * len).toFixed(1)} ${(60 + Math.sin(a) * len).toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`
    }
    return s
  }
  if (kind === 'health') {
    const teeth = [40, 140, 220, 320].map(deg => {
      const a = (deg * Math.PI) / 180
      return `<path d="${tooth(60 + Math.cos(a) * 56, 60 + Math.sin(a) * 56, a + Math.PI, 9, 3.4)}" fill="${bone}" stroke="#171208" stroke-width="0.8"/>`
    }).join('')
    return `<svg class="orb-frame" viewBox="0 0 120 120" aria-hidden="true">${defs}
      <path d="${knappedRing(0xbeef, 56.5, 1.5)}" fill="none" stroke="${obs}" stroke-width="7" stroke-linejoin="round"/>
      <path d="${knappedRing(0xbeef, 56.5, 1.5)}" fill="none" stroke="rgba(226,214,192,0.14)" stroke-width="1.1" stroke-dasharray="14 9 6 17"/>
      <path d="M14 40 L20 44 L15 49 Z M103 74 L97 78 L102 83 Z M70 6 L66 12 L73 11 Z" fill="#050404"/>
      <circle cx="60" cy="60" r="52.5" fill="none" stroke="${bone}" stroke-width="3.2"/>
      <circle cx="60" cy="60" r="52.5" fill="none" stroke="rgba(20,14,8,0.55)" stroke-width="0.9" stroke-dasharray="3 5"/>
      ${ticks(14, 48.6, 50.6, 0x77, 'rgba(28,20,12,0.6)', 1.1)}
      <circle cx="60" cy="60" r="49.5" fill="none" stroke="#0b0806" stroke-width="3.4"/>
      <path d="M22 40 A49.5 49.5 0 0 1 60 10.5" fill="none" stroke="rgba(232,220,198,0.22)" stroke-width="1.4"/>
      ${teeth}
      <path d="M60 3.5 L64 10 L60 15 L56 10 Z" fill="${bone}" stroke="#171208" stroke-width="0.8"/>
      <path d="M17 78 A52.5 52.5 0 0 0 34 100" fill="none" stroke="#5a3d22" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M20 82 L26 78 M24 89 L30 85 M29 95 L35 91" stroke="#2c1c0e" stroke-width="1.4"/>
      <circle cx="97" cy="30" r="2.6" fill="url(#${uid}-copper)" stroke="#1c1008" stroke-width="0.7"/>
      <circle cx="26" cy="26" r="2.2" fill="url(#${uid}-copper)" stroke="#1c1008" stroke-width="0.7"/>
      <path d="M84 12 L88 17 M92 96 L88 91" stroke="rgba(0,0,0,0.4)" stroke-width="1.2"/>
      <g class="orb-crack">
        <path d="M18 66 L26 63 L30 68 L38 65 L43 70" fill="none" stroke="#080503" stroke-width="1.7"/>
        <path d="M18 67.4 L26 64.4 L30 69.4 L38 66.4" fill="none" stroke="rgba(226,214,192,0.16)" stroke-width="0.7"/>
        <path d="M99 47 L92 51 L89 46 L82 50" fill="none" stroke="#080503" stroke-width="1.5"/>
      </g>
    </svg>`
  }
  const studs = [90, 210, 330].map(deg => {
    const a = (deg * Math.PI) / 180
    return `<circle cx="${(60 + Math.cos(a) * 53).toFixed(1)}" cy="${(60 + Math.sin(a) * 53).toFixed(1)}" r="3" fill="url(#${uid}-copper)" stroke="#1c1008" stroke-width="0.8"/>`
  }).join('')
  return `<svg class="orb-frame" viewBox="0 0 120 120" aria-hidden="true">${defs}
    <path d="${knappedRing(0xf00d, 56, 1.1)}" fill="none" stroke="${bone}" stroke-width="6.5" stroke-linejoin="round"/>
    <path d="${knappedRing(0xf00d, 56, 1.1)}" fill="none" stroke="rgba(24,16,8,0.4)" stroke-width="1" stroke-dasharray="10 7 4 13"/>
    <circle cx="60" cy="60" r="51" fill="none" stroke="${wood}" stroke-width="4"/>
    ${ticks(8, 45.4, 47.4, 0x33, 'rgba(20,12,6,0.65)', 1.2)}
    <circle cx="60" cy="60" r="47.5" fill="none" stroke="#0c0805" stroke-width="3"/>
    <path d="M24 42 A47.5 47.5 0 0 1 60 12.5" fill="none" stroke="rgba(232,220,198,0.18)" stroke-width="1.2"/>
    ${studs}
    <path d="M84 92 A52 52 0 0 0 99 72" fill="none" stroke="#5a3d22" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M88 88 L93 84 M93 81 L98 77" stroke="#2c1c0e" stroke-width="1.2"/>
  </svg>`
}

const approach = (v: number, t: number, step: number) => (v < t ? Math.min(t, v + step) : Math.max(t, v - step))

export class StatusOrb {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly wrap: HTMLElement
  private readonly num: HTMLElement | null
  private readonly pal: Palette
  private readonly uid: string
  private target = 1
  private display = 1
  private lostTarget = 1
  private lostDisplay = 1
  private agit = 0
  private flashT = 0
  private pulseT = 0
  private shakeT = 0
  private low = false
  private time = 0
  private size = 0
  private dpr = 1
  private lastText = ''
  private splat: { a: number; r: number; s: number }[] = []
  private disposed = false

  constructor(readonly root: HTMLElement, readonly kind: OrbKind) {
    this.pal = PAL[kind]
    this.uid = `orb-${kind}`
    noiseUsers += 1
    root.classList.add('orb', `orb-${kind}`)
    root.innerHTML = ''
    this.wrap = document.createElement('div')
    this.wrap.className = 'orb-shake'
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'orb-canvas'
    this.ctx = this.canvas.getContext('2d')!
    this.wrap.appendChild(this.canvas)
    this.wrap.insertAdjacentHTML('beforeend', frameSvg(kind, this.uid))
    this.num = kind === 'health' ? document.createElement('span') : null
    if (this.num) {
      this.num.className = 'g-num'
      this.wrap.appendChild(this.num)
    }
    root.appendChild(this.wrap)
    this.resize()
  }

  setValue(current: number, max: number): void {
    this.setPercentage(max > 0 ? current / max : 0)
    if (this.num) {
      const t = `${Math.ceil(current)} / ${max}`
      if (t !== this.lastText) { this.num.textContent = t; this.lastText = t }
    }
  }

  setPercentage(value: number): void {
    const t = Math.max(0, Math.min(1, value))
    const d = Math.abs(t - this.target)
    if (d > 0.0005) this.agit = Math.min(1.4, this.agit + d * 5)
    this.target = t
  }

  /** Pale ghost of recently lost volume, trails behind the live surface. */
  setLost(frac: number): void {
    this.lostTarget = Math.max(this.target, Math.max(0, Math.min(1, frac)))
  }

  setLow(on: boolean): void {
    if (on === this.low) return
    this.low = on
    this.root.classList.toggle('low', on)
  }

  playDamageEffect(amount = 12): void {
    this.flashT = 0.5
    this.shakeT = 0.32
    this.agit = Math.min(1.6, this.agit + 0.5 + amount / 60)
    const rnd = mulberry((Math.random() * 1e9) | 0)
    this.splat = Array.from({ length: 5 }, () => ({ a: rnd() * Math.PI * 2, r: 0.55 + rnd() * 0.4, s: 0.05 + rnd() * 0.09 }))
  }

  playRecoverEffect(): void {
    this.pulseT = 0.8
  }

  /** Quick amber glint when stamina is burnt. */
  playSpendEffect(): void {
    this.flashT = Math.max(this.flashT, 0.28)
    this.agit = Math.min(1.4, this.agit + 0.35)
  }

  update(dt: number): void {
    if (this.disposed) return
    this.time += dt
    const down = this.target < this.display
    this.display = approach(this.display, this.target, dt * (down ? 7 : 2.4))
    this.lostDisplay = Math.max(this.display, approach(this.lostDisplay, Math.max(this.target, this.lostTarget), dt * 0.55))
    this.agit = Math.max(0, this.agit - dt * 1.5)
    this.flashT = Math.max(0, this.flashT - dt)
    this.pulseT = Math.max(0, this.pulseT - dt)
    this.shakeT = Math.max(0, this.shakeT - dt)
    if (this.shakeT > 0) {
      const k = this.shakeT / 0.32
      const j = 2.2 * k * k
      this.wrap.style.transform = `translate(${(Math.sin(this.time * 71) * j).toFixed(2)}px, ${(Math.cos(this.time * 57) * j * 0.7).toFixed(2)}px)`
    } else if (this.wrap.style.transform) this.wrap.style.transform = ''
    this.resize()
    this.render()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.innerHTML = ''
    this.root.classList.remove('orb', `orb-${this.kind}`, 'low')
    this.ctx.canvas.width = this.ctx.canvas.height = 0
    noiseUsers -= 1
    if (noiseUsers <= 0) { noise = null; noiseUsers = 0 }
  }

  private resize(): void {
    const s = this.root.clientWidth
    if (!s) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (s === this.size && dpr === this.dpr) return
    this.size = s
    this.dpr = dpr
    this.canvas.width = Math.round(s * dpr)
    this.canvas.height = Math.round(s * dpr)
  }

  private render(): void {
    const S = this.size
    if (!S) return
    const c = this.ctx
    const P = this.pal
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    c.clearRect(0, 0, S, S)
    const cx = S / 2, cy = S / 2
    const R = S * 0.5 - S * 0.075
    const t = this.time
    c.save()
    c.beginPath()
    c.arc(cx, cy, R, 0, Math.PI * 2)
    c.clip()

    // Empty vessel: dark hollow with a lit upper wall.
    const empty = c.createRadialGradient(cx, cy - R * 0.3, R * 0.1, cx, cy, R * 1.05)
    empty.addColorStop(0, P.emptyIn)
    empty.addColorStop(1, P.emptyOut)
    c.fillStyle = empty
    c.fillRect(0, 0, S, S)

    // Leave a little headspace even when full, so the curved surface and the dark
    // hollow above it always read as a vessel holding liquid — never a flat bead.
    const topY = cy - R * 0.82
    const botY = cy + R * 0.98
    const level = botY - (botY - topY) * this.display
    const lostLevel = botY - (botY - topY) * this.lostDisplay
    const amp = R * 0.018 + this.agit * R * 0.05
    const bow = R * 0.1
    const surf = (x: number) => {
      const dx = (x - cx) / R
      const edge = Math.sqrt(Math.max(0, 1 - dx * dx))
      return level + bow * (1 - dx * dx) + edge * (Math.sin(x * 0.11 + t * 2.1) * amp + Math.sin(x * 0.052 - t * 1.4) * amp * 0.6)
    }

    // Recently lost volume: bone-pale ghost above the live surface.
    if (this.lostDisplay - this.display > 0.004) {
      c.save()
      c.beginPath()
      c.moveTo(cx - R, lostLevel)
      for (let x = cx - R; x <= cx + R; x += 3) c.lineTo(x, lostLevel + bow * (1 - ((x - cx) / R) ** 2) * 0.6)
      c.lineTo(cx + R, surf(cx + R))
      for (let x = cx + R; x >= cx - R; x -= 3) c.lineTo(x, surf(x))
      c.closePath()
      c.fillStyle = P.lost
      c.fill()
      c.restore()
    }

    // Liquid body.
    c.save()
    c.beginPath()
    c.moveTo(cx - R, surf(cx - R))
    for (let x = cx - R; x <= cx + R; x += 2) c.lineTo(x, surf(x))
    c.lineTo(cx + R, cy + R + 2)
    c.lineTo(cx - R, cy + R + 2)
    c.closePath()
    c.clip()
    const body = c.createLinearGradient(0, level - R * 0.1, 0, cy + R)
    body.addColorStop(0, P.top)
    body.addColorStop(0.38, P.mid)
    body.addColorStop(0.78, P.deep)
    body.addColorStop(1, P.bottom)
    c.fillStyle = body
    c.fillRect(0, 0, S, S)

    // Suspended flecks: slow convection inside the fluid.
    c.fillStyle = P.mote
    for (let i = 0; i < 7; i += 1) {
      const ph = i * 1.37
      const yy = cy + R - ((t * (3 + (i % 3)) + ph * 40) % (2 * R))
      const xx = cx + Math.sin(ph * 5 + t * 0.35) * R * 0.62
      if (yy > surf(xx) + 2) {
        c.beginPath()
        c.arc(xx, yy, R * (0.014 + (i % 3) * 0.008), 0, Math.PI * 2)
        c.fill()
      }
    }

    // Warm specular: a soft sheen on the fluid, not a glass hotspot.
    const spec = c.createRadialGradient(cx - R * 0.34, level + R * 0.34, 0, cx - R * 0.34, level + R * 0.34, R * 0.72)
    spec.addColorStop(0, P.spec)
    spec.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = spec
    c.fillRect(0, 0, S, S)

    // Spherical volume: light grazes the upper-left while the lower-right sinks into
    // shadow, so the fluid reads as a domed body rather than a flat disc.
    const sph = c.createRadialGradient(cx - R * 0.3, cy - R * 0.32, R * 0.12, cx + R * 0.12, cy + R * 0.2, R * 1.18)
    sph.addColorStop(0, 'rgba(0,0,0,0)')
    sph.addColorStop(0.5, 'rgba(0,0,0,0)')
    sph.addColorStop(0.82, P.rim)
    sph.addColorStop(1, 'rgba(0,0,0,0.6)')
    c.fillStyle = sph
    c.fillRect(0, 0, S, S)

    // Grain.
    c.globalAlpha = 0.06
    c.globalCompositeOperation = 'overlay'
    const off = Math.floor(t * 4) % 7
    c.drawImage(grain(), -off, -off, S + 7, S + 7)
    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = 1

    // Damage: dark blood flush + wall splatter.
    if (this.flashT > 0 && this.kind === 'health') {
      const k = this.flashT / 0.5
      c.fillStyle = P.flash
      c.globalAlpha = k * 0.85
      c.fillRect(0, 0, S, S)
      c.globalAlpha = k * 0.7
      c.fillStyle = '#4a0b07'
      for (const s of this.splat) {
        const x = cx + Math.cos(s.a) * R * s.r
        const y = cy + Math.sin(s.a) * R * s.r
        c.beginPath()
        c.ellipse(x, y, R * s.s, R * s.s * 0.62, s.a, 0, Math.PI * 2)
        c.fill()
      }
      c.globalAlpha = 1
    } else if (this.flashT > 0) {
      c.globalAlpha = (this.flashT / 0.28) * 0.5
      c.fillStyle = P.flash
      c.fillRect(0, 0, S, S)
      c.globalAlpha = 1
    }

    // Recovery: a warm ring swelling through the fluid.
    if (this.pulseT > 0) {
      const k = 1 - this.pulseT / 0.8
      c.strokeStyle = `${P.pulse}${(0.5 * (1 - k)).toFixed(3)})`
      c.lineWidth = R * 0.09 * (1 - k) + 1
      c.beginPath()
      c.arc(cx, cy + R * 0.15, R * (0.2 + k * 0.85), 0, Math.PI * 2)
      c.stroke()
    }
    c.restore()

    // Meniscus: lit surface line with a shadowed underside.
    c.beginPath()
    c.moveTo(cx - R, surf(cx - R))
    for (let x = cx - R; x <= cx + R; x += 2) c.lineTo(x, surf(x))
    c.strokeStyle = P.surface
    c.lineWidth = Math.max(1.2, R * 0.045)
    c.globalAlpha = 0.85
    c.stroke()
    c.globalAlpha = 0.35
    c.strokeStyle = P.bottom
    c.lineWidth = Math.max(1, R * 0.03)
    c.beginPath()
    c.moveTo(cx - R, surf(cx - R) + R * 0.05)
    for (let x = cx - R; x <= cx + R; x += 2) c.lineTo(x, surf(x) + R * 0.05)
    c.stroke()
    c.globalAlpha = 1

    // Low health: restrained dark-red breathing at the wall.
    if (this.low) {
      const a = 0.2 + 0.14 * Math.sin(t * 2.6)
      const g2 = c.createRadialGradient(cx, cy, R * 0.62, cx, cy, R)
      g2.addColorStop(0, 'rgba(0,0,0,0)')
      g2.addColorStop(1, `rgba(150, 26, 18, ${a.toFixed(3)})`)
      c.fillStyle = g2
      c.fillRect(0, 0, S, S)
    }

    // Inner wall shadow seats the liquid inside the frame groove.
    const wall = c.createRadialGradient(cx, cy, R * 0.82, cx, cy, R)
    wall.addColorStop(0, 'rgba(0,0,0,0)')
    wall.addColorStop(1, 'rgba(0,0,0,0.72)')
    c.fillStyle = wall
    c.fillRect(0, 0, S, S)
    c.restore()
  }
}