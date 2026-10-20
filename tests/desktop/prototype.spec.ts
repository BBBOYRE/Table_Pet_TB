import { test, expect, type Page } from '@playwright/test'
import { _electron, type ElectronApplication } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

let application: ElectronApplication
let panel: Page
let pet: Page
let applicationClosed = true
const errors: string[] = []
const directory = resolve(`.local/desktop-${Date.now()}`)
async function launch() {
  const env: Record<string, string> = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')), TB_TEST_MODE: '1', TB_DATA_DIR: directory }
  delete env.ELECTRON_RUN_AS_NODE
  application = await _electron.launch({ args: ['.'], env })
  applicationClosed = false
  application.on('close', () => { applicationClosed = true })
  await expect.poll(() => application.windows().length).toBe(2)
  pet = application.windows().find(page => page.url().includes('view=pet'))!
  panel = application.windows().find(page => page.url().includes('view=panel'))!
  for (const page of [panel, pet]) page.on('pageerror', error => errors.push(error.message))
  await expect(panel.getByRole('heading', { name: '给桌面，添一点陪伴。' })).toBeVisible()
}
test.beforeAll(async () => { mkdirSync(directory, { recursive: true }); await launch() })
test.afterAll(async () => { if (!applicationClosed) await application.close() })

test('starts offline with isolated renderers and a transparent pet', async () => {
  const config = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => ({ title: window.getTitle(), focusable: window.isFocusable() })))
  expect(config.find(value => value.title.includes('小芽'))?.focusable).toBe(false)
  expect(await pet.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined')
  expect(await pet.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  expect(await pet.evaluate(() => window.pet.snapshot())).toMatchObject({ action: 'idle', assetError: null })
  mkdirSync('.local/verification', { recursive: true })
  await panel.screenshot({ path: '.local/verification/p00-home.png', animations: 'disabled' })
  await pet.screenshot({ path: '.local/verification/p00-pet.png', omitBackground: true, animations: 'disabled' })
})
test('plays local actions and falls back to idle without a model', async () => {
  await panel.getByRole('button', { name: /开心一下/ }).click()
  await expect(pet.getByTestId('pet-stage')).toHaveAttribute('data-action', 'happy')
  await expect(pet.getByTestId('pet-stage')).toHaveAttribute('data-action', 'idle', { timeout: 4000 })
  const bad = await pet.evaluate(() => window.pet.command({ type: 'action', action: 'unknown' } as never))
  expect(bad.ok).toBe(false)
})
test('accepts Chinese text and recovers from missing character data', async () => {
  await panel.getByRole('button', { name: '原型检查' }).click()
  await panel.getByRole('textbox', { name: '中文输入验证' }).fill('你好，小芽。中文输入与焦点正常。')
  await expect(panel.getByRole('textbox')).toHaveValue('你好，小芽。中文输入与焦点正常。')
  await panel.getByRole('button', { name: '模拟素材缺失' }).click()
  await expect(pet.getByTestId('pet-stage')).toHaveAttribute('data-error', 'true')
  await expect(pet.getByRole('button', { name: '恢复测试角色' })).toBeVisible()
  await panel.getByRole('button', { name: '恢复测试角色' }).click()
  await expect(pet.getByTestId('pet-stage')).toHaveAttribute('data-error', 'false')
})
test('clamps a stale position and preserves settings across a restart', async () => {
  await application.evaluate(() => (globalThis as any).__tbTest.place({ x: -99999, y: 99999 }))
  const before = await pet.evaluate(() => window.pet.snapshot())
  expect(before.petBounds.x).toBeGreaterThanOrEqual(before.displays[0].workArea.x)
  await panel.getByRole('button', { name: '陪伴空间' }).click()
  await panel.getByRole('checkbox', { name: /安静展示/ }).click()
  await expect(panel.getByRole('checkbox', { name: /安静展示/ })).toBeChecked()
  await expect(pet.locator('.pet-bubble')).toHaveCount(0)
  await application.close()
  await launch()
  expect((await pet.evaluate(() => window.pet.snapshot())).settings.quiet).toBe(true)
  await panel.getByRole('checkbox', { name: /安静展示/ }).click()
  await expect(panel.getByRole('checkbox', { name: /安静展示/ })).not.toBeChecked()
})
test('keeps the pet running when the panel closes and provides tray recovery', async () => {
  await panel.close()
  expect(application.windows().length).toBe(1)
  const labels = await application.evaluate(() => (globalThis as any).__tbTest.trayMenu().items.map((item: { label: string }) => item.label))
  expect(labels).toContain('找回桌宠 / 重置位置')
  expect(labels).toContain('退出桌宠')
  await application.evaluate(() => (globalThis as any).__tbTest.openPanel())
  await expect.poll(() => application.windows().length).toBe(2)
  panel = application.windows().find(page => page.url().includes('view=panel'))!
  expect(errors).toEqual([])
})

test('native Windows pointer passes through empty pixels, clicks the character, and drags it', async () => {
  test.skip(process.platform !== 'win32', 'Windows native input check')
  const setup = await application.evaluate(async ({ BrowserWindow, screen }) => {
    const probe = new BrowserWindow({ x: 65, y: 65, width: 520, height: 520, frame: false, alwaysOnTop: true, backgroundColor: '#f3e4ce' })
    await probe.loadURL('data:text/html,<html><body style="margin:0;height:100vh">Pointer test: <b id="count">0</b><script>let n=0;window.addEventListener("click",()=>document.getElementById("count").textContent=String(++n))</script></body></html>')
    const tb = (globalThis as any).__tbTest
    tb.place({ x: 120, y: 120 })
    const petWindow = tb.pet()
    petWindow.setAlwaysOnTop(true)
    petWindow.moveTop()
    const bounds = petWindow.getBounds()
    const point = (x: number, y: number) => screen.dipToScreenPoint({ x: bounds.x + x, y: bounds.y + y })
    return {
      id: probe.id,
      handles: [probe, petWindow].map(w => w.getNativeWindowHandle().readBigUInt64LE().toString()).join(','),
      empty: point(8, 80), face: point(140, 155), body: point(140, 230), end: point(230, 270),
      before: bounds
    }
  })
  const probePage = application.windows().find(page => page.url().startsWith('data:'))!
  const native = async (point: { x: number; y: number }, end?: { x: number; y: number }) => {
    await promisify(execFile)('powershell.exe', ['-NoProfile', '-File', resolve('tests/desktop/native-pointer.ps1'), '-X', String(point.x), '-Y', String(point.y), '-AllowedHandles', setup.handles, ...(end ? ['-EndX', String(end.x), '-EndY', String(end.y)] : [])], { windowsHide: true })
  }
  try {
    await native(setup.empty)
    await expect(probePage.locator('#count')).toHaveText('1')
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id)).toBe(setup.id)
    await native(setup.face)
    await expect(pet.getByTestId('pet-stage')).toHaveAttribute('data-action', 'greet')
    await expect(probePage.locator('#count')).toHaveText('1')
    await native(setup.body, setup.end)
    await expect.poll(async () => (await pet.evaluate(() => window.pet.snapshot())).dragging).toBe(false)
    const after = await pet.evaluate(() => window.pet.snapshot())
    expect(Math.abs(after.petBounds.x - setup.before.x - 90)).toBeLessThanOrEqual(2)
    expect(Math.abs(after.petBounds.y - setup.before.y - 40)).toBeLessThanOrEqual(2)
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id)).toBe(setup.id)
    await application.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)?.minimize(), setup.id)
    await expect.poll(() => application.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)?.isMinimized(), setup.id)).toBe(true)
    expect(await application.evaluate(() => (globalThis as any).__tbTest.pet().isVisible())).toBe(true)
    await application.evaluate(() => (globalThis as any).__tbTest.openPanel())
    await expect(panel.getByRole('button', { name: '原型检查' })).toBeVisible()
  } finally {
    await application.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)?.close(), setup.id)
  }
})

test('restores the pet renderer after a crash from the control panel', async () => {
  await application.evaluate(() => (globalThis as any).__tbTest.pet().webContents.forcefullyCrashRenderer())
  await panel.getByRole('button', { name: '原型检查' }).click()
  await Promise.all([pet.waitForEvent('load'), panel.getByRole('button', { name: '恢复测试角色' }).click()])
  // Playwright retains the crashed target; query the recovered renderer through Electron.
  await expect.poll(() => application.evaluate(async () => {
    const tb = (globalThis as any).__tbTest
    return tb.pet().webContents.executeJavaScript('document.querySelector("[data-testid=pet-stage]")?.dataset.error')
  })).toBe('false')
  expect(await application.evaluate(() => (globalThis as any).__tbTest.snapshot().dragging)).toBe(false)
})

test('exits cleanly through the tray menu command', async () => {
  const closed = application.waitForEvent('close')
  await application.evaluate(() => (globalThis as any).__tbTest.trayMenu().items.find((item: { label: string }) => item.label === '退出桌宠').click())
  await closed
})
