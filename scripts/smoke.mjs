// 《烬野：暗影回响》浏览器冒烟测试：使用现有项目脚本，不依赖旧模板的“能量核心”状态。
// 先运行 pnpm build；随后从 dist 启动临时 Vite Preview，失败时保留浏览器/网络错误与截图。
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? '.work/previews/smoke'
mkdirSync(out, { recursive: true })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', detached: false })
let browser
const errors = []
const guard = setTimeout(() => fail('测试总时限 5 分钟'), 300_000)

function cleanup() {
  clearTimeout(guard)
  try { server.kill('SIGTERM') } catch {}
}
async function fail(message) {
  console.error(`冒烟测试失败：${message}`)
  await browser?.close().catch(() => {})
  cleanup()
  process.exit(1)
}
async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Vite Preview 未能启动')
}
async function openGame(context, label) {
  const page = await context.newPage()
  page.on('console', message => message.type() === 'error' && errors.push(`${label}: console ${message.text()}`))
  page.on('pageerror', error => errors.push(`${label}: page ${String(error)}`))
  page.on('requestfailed', request => errors.push(`${label}: request ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`))
  page.on('response', response => response.status() >= 400 && errors.push(`${label}: HTTP ${response.status()} ${response.url()}`))
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-el="title"].on', { timeout: 30_000 })
  await page.waitForFunction(() => window.__game?.game?.mode === 'title', null, { timeout: 30_000 })
  return page
}
const snapshot = page => page.evaluate(() => {
  const { game, ui } = window.__game
  const p = game.player
  return {
    mode: game.mode,
    screen: ui.screen,
    region: game.region,
    elapsed: game.progress.playTime,
    player: { x: p.pos.x, z: p.pos.z, state: p.state, hp: p.hp, stamina: p.stamina },
    beasts: game.creatures.filter(c => c.alive).length,
  }
})
const waitFor = async (page, expression, label) => {
  try { await page.waitForFunction(expression, null, { timeout: 8_000 }) }
  catch { throw new Error(`未能进入${label}`) }
}

try {
  await waitForServer()
  // 优先 Playwright 自带 Chromium；若当前安装不可用，再尝试系统 Chrome。
  const args = ['--ignore-gpu-blocklist']
  browser = await chromium.launch({ args }).catch(() => chromium.launch({ args, channel: 'chrome' }))

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
  const page = await openGame(desktop, 'desktop')
  const title = await page.title()
  const lang = await page.evaluate(() => document.documentElement.lang)
  if (!title.includes('烬野：暗影回响')) throw new Error(`浏览器标题不一致：${title}`)
  if (lang !== 'zh-CN') throw new Error(`页面语言不是简体中文：${lang}`)
  const wordmark = await page.locator('.title-card .wordmark-main').textContent()
  if (!wordmark?.includes('烬野')) throw new Error('首屏游戏字标缺失或品牌错误')
  await page.screenshot({ path: `${out}/01-title.png` })

  // 首屏的帮助浮层必须能打开、关闭，且中文翻译完整。
  await page.locator('[data-el="title"] [data-act="help"]').click()
  await waitFor(page, () => !document.querySelector('[data-el="help"]').hidden, '操作指南')
  const helpText = await page.locator('[data-el="help"]').innerText()
  if (!helpText.includes('闪避') || !helpText.includes('狩猎')) throw new Error('操作指南未完成简体中文化')
  await page.locator('[data-el="help"] [data-act="help"]').click()

  await page.locator('[data-el="title"] [data-act="new"]').click()
  await waitFor(page, () => document.querySelector('[data-el="hud"]').classList.contains('on') && window.__game?.game?.mode === 'playing', '新远征 HUD')
  await page.waitForTimeout(900)
  await waitFor(page, () => document.querySelector('[data-el="tip"]')?.textContent?.includes('目标标记'), '简体中文开局教程')
  const openingTip = await page.locator('[data-el="tip"]').innerText()
  if (!openingTip.includes('移动') || /\b(move|Mouse|look|sprint|interact|Follow|objective marker)\b/i.test(openingTip)) throw new Error(`开局教程含有未翻译英文：${openingTip}`)
  await page.screenshot({ path: `${out}/02-gameplay-start.png` })
  const before = await snapshot(page)
  if (before.beasts < 1) throw new Error('开局没有载入荒兽实例')

  // 验证真正的战斗动作状态，而非只确认页面收到按键。
  await page.keyboard.press('KeyJ')
  await page.waitForTimeout(120)
  const attackState = await page.evaluate(() => window.__game.game.player.state)
  if (attackState !== 'attack') throw new Error(`轻击未触发，当前动作状态为 ${attackState}`)
  await page.waitForTimeout(500)
  await page.keyboard.press('Space')
  await page.waitForTimeout(120)
  const dodgeState = await page.evaluate(() => window.__game.game.player.state)
  if (dodgeState !== 'dodge') throw new Error(`闪避未触发，当前动作状态为 ${dodgeState}`)
  await page.waitForTimeout(500)

  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(950)
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  const afterMove = await snapshot(page)
  const moved = Math.hypot(afterMove.player.x - before.player.x, afterMove.player.z - before.player.z)
  if (afterMove.mode !== 'playing') throw new Error(`远征没有保持进行状态：${afterMove.mode}`)
  if (afterMove.elapsed <= before.elapsed) throw new Error('远征计时没有推进')
  if (moved < 0.6) throw new Error(`猎手移动距离过小：${moved.toFixed(2)} 米`)
  await page.screenshot({ path: `${out}/03-gameplay-combat.png` })

  // 物品袋、中文页签、地图、猎人日志都通过正式键位打开/关闭。
  await page.keyboard.press('Tab')
  await waitFor(page, () => document.querySelector('[data-el="menu"]').classList.contains('on'), '随身包')
  const materialsTab = await page.locator('[data-el="menu"] [data-tab="materials"]').innerText()
  if (!materialsTab.includes('材料')) throw new Error(`随身包页签不是中文：${materialsTab}`)
  await page.screenshot({ path: `${out}/04-satchel.png` })
  await page.keyboard.press('Digit6')
  await waitFor(page, () => document.querySelector('[data-el="menu"] [data-tab="journal"].on'), '猎人手记页签')
  const journalTab = await page.locator('[data-el="menu"] [data-tab="journal"]').innerText()
  if (!journalTab.includes('手记')) throw new Error(`猎人日志页签不是中文：${journalTab}`)
  await page.keyboard.press('Escape')
  await waitFor(page, () => document.querySelector('[data-el="hud"]').classList.contains('on'), '返回 HUD')
  
  await page.keyboard.press('KeyM')
  await waitFor(page, () => !document.querySelector('[data-el="map"]').hidden, '荒岛地图')
  await page.screenshot({ path: `${out}/05-map.png` })
  await page.keyboard.press('KeyM')
  await page.keyboard.press('KeyH')
  await waitFor(page, () => !document.querySelector('[data-el="help"]').hidden, '战斗帮助')
  await page.keyboard.press('KeyH')

  await page.keyboard.press('Escape')
  await waitFor(page, () => document.querySelector('[data-el="pause"]').classList.contains('on'), '暂停菜单')
  await page.screenshot({ path: `${out}/06-pause.png` })
  const settingsButton = page.locator('[data-el="pause"] [data-act="settings"]')
  await settingsButton.focus()
  await page.keyboard.press('Enter')
  await waitFor(page, () => !document.querySelector('[data-el="settings"]').hidden, '设置')
  await page.screenshot({ path: `${out}/07-settings.png` })
  await page.keyboard.press('Escape')
  await waitFor(page, () => document.querySelector('[data-el="settings"]').hidden, '关闭设置')
  if ((await snapshot(page)).mode !== 'paused') throw new Error('关闭设置时错误恢复了远征')
  const resumeButton = page.locator('[data-el="pause"] [data-act="resume"]')
  await resumeButton.focus()
  await page.keyboard.press('Enter')
  await waitFor(page, () => window.__game.game.mode === 'playing' && document.querySelector('[data-el="hud"]').classList.contains('on'), '恢复远征')
  await desktop.close()

  // 这里只验收手机尺寸下的首屏/HUD 布局；不把触屏当作已有的战斗输入功能。
  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' })
  const phonePage = await openGame(phone, 'phone')
  await phonePage.locator('[data-el="title"] [data-act="new"]').tap()
  await waitFor(phonePage, () => document.querySelector('[data-el="hud"]').classList.contains('on') && window.__game.game.mode === 'playing', '手机视口 HUD')
  await phonePage.waitForTimeout(700)
  const overflow = await phonePage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)
  if (overflow) throw new Error('手机视口出现横向溢出')
  await phonePage.screenshot({ path: `${out}/08-phone-hud.png` })
  await phone.close()

  if (errors.length) throw new Error(`浏览器、页面或资源错误：\n  ${errors.join('\n  ')}`)
  await browser.close()
  cleanup()
  console.log(`冒烟测试通过：轻击、闪避、移动、物品袋、图鉴、地图、暂停/设置和中文手机视口；截图见 ${out}/`)
} catch (error) {
  await fail(error?.message ?? String(error))
}
