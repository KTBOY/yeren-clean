// Renders every skill-bar icon through scripts/iconforge.html and writes 512px transparent PNGs.
// Usage: pnpm icons   (needs the dev server: pnpm dev)
import { mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = process.env.ICONFORGE_BASE ?? 'http://127.0.0.1:3000'
const OUT = path.resolve(import.meta.dirname, '../public/ui/icons')
const TARGET = 512

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: TARGET, height: TARGET } })
  page.on('pageerror', e => console.error('[iconforge] pageerror:', e.message))
  await page.goto(`${BASE}/scripts/iconforge.html`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__iconforge === 'ready', null, { timeout: 120000 })
  const icons = await page.evaluate(() => ({ out: window.__icons ?? [], names: window.__iconNames ?? [] }))
  if (icons.out.length !== icons.names.length) throw new Error(`渲染数量不符：期望 ${icons.names.length}，实际 ${icons.out.length}`)
  for (const { name, data } of icons.out) {
    const png = Buffer.from(data.split(',')[1], 'base64')
    const file = path.join(OUT, `${name}.png`)
    await sharp(png).resize(TARGET, TARGET, { fit: 'contain' }).png({ compressionLevel: 9 }).toFile(file)
    const info = await sharp(file).metadata()
    console.log(`${name}.png  ${info.width}x${info.height}  ${statSync(file).size} bytes`)
  }
} finally {
  await browser.close()
}
