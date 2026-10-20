import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, session, Tray } from 'electron'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clampToDisplays } from '../core/geometry.ts'
import { defaults, isCommand, parseCharacter } from '../core/validation.ts'
import type { Character, Command, PetAction, Point, Settings, Snapshot } from '../shared/contracts.ts'
import { readSettings, writeSettings } from './settings.ts'

const here = dirname(fileURLToPath(import.meta.url))
const PET_SIZE = { width: 280, height: 340 }
const testMode = process.env.TB_TEST_MODE === '1'
const benchmarkDir = process.env.TB_BENCHMARK_DIR
const idleBenchmark = testMode && !!benchmarkDir && process.env.TB_BENCHMARK_IDLE === '1'
app.setName('Table Pet TB')
app.setPath('userData', process.env.TB_DATA_DIR ? resolve(process.env.TB_DATA_DIR) : join(app.getPath('appData'), 'TablePetTB'))
const settingsPath = join(app.getPath('userData'), 'settings.json')
let settings: Settings = { ...defaults }
let pet: BrowserWindow
let panel: BrowserWindow | null = null
let tray: Tray | null = null
let trayMenu: Menu | null = null
let character: Character | null = null
let assetError: string | null = null
let action: PetAction = 'idle'
let actionToken = 0
let actionTimer: ReturnType<typeof setTimeout> | undefined
let drag: { cursor: Point; origin: Point; moved: boolean; started: number } | null = null
let dragTimer: ReturnType<typeof setInterval> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let metricsTimer: ReturnType<typeof setInterval> | undefined
let pointerTimer: ReturnType<typeof setInterval> | undefined
let writeQueue = Promise.resolve()
let quitting = false
let mousePassthrough = true
let lastAction = 0
let reportedFps = 0
let readyRecorded = false

const areas = () => screen.getAllDisplays().map(d => d.workArea)
function snapshot(): Snapshot {
  return {
    version: app.getVersion(), character, assetError, action, actionToken, settings: { ...settings },
    petBounds: pet.getBounds(),
    displays: screen.getAllDisplays().map(({ id, scaleFactor, workArea }) => ({ id, scaleFactor, workArea })),
    dragging: !!drag, mousePassthrough
  }
}
function broadcast() {
  if (!pet || pet.isDestroyed() || quitting) return
  for (const window of [pet, panel]) if (window && !window.isDestroyed()) window.webContents.send('tb:state', snapshot())
}
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const value = structuredClone(settings)
    writeQueue = writeQueue.then(() => writeSettings(settingsPath, value)).catch(() => console.error('Could not save local settings.'))
  }, 250)
}
function passthrough(value: boolean) {
  if (!pet || pet.isDestroyed() || mousePassthrough === value) return
  mousePassthrough = value
  pet.setIgnoreMouseEvents(value, { forward: true })
}
function place(point?: Point) {
  const position = clampToDisplays(point, PET_SIZE, areas())
  pet.setPosition(position.x, position.y, false)
  settings.position = position
  persist()
  broadcast()
}
function play(next: PetAction) {
  if (idleBenchmark) return { ok: false, error: '待机测量中，请等待测试结束。' }
  if (!character?.actions.includes(next)) return { ok: false, error: '这个测试角色暂不支持该动作。' }
  if (next !== 'idle' && Date.now() - lastAction < 250) return { ok: false, error: '动作正在切换，请稍候。' }
  lastAction = Date.now()
  clearTimeout(actionTimer)
  action = next
  actionToken++
  broadcast()
  if (next !== 'idle') actionTimer = setTimeout(() => { action = 'idle'; actionToken++; broadcast() }, next === 'thinking' ? 4200 : 2400)
  return { ok: true }
}
function endDrag(cancel = false) {
  if (!drag) return
  const moved = drag.moved
  drag = null
  clearInterval(dragTimer)
  const { x, y } = pet.getBounds()
  place({ x, y })
  if (!cancel && !moved) play('greet')
  broadcast()
}
function beginDrag() {
  if (idleBenchmark) return
  if (drag || pet.isDestroyed()) return
  const { x, y } = pet.getBounds()
  drag = { cursor: screen.getCursorScreenPoint(), origin: { x, y }, moved: false, started: Date.now() }
  passthrough(false)
  dragTimer = setInterval(() => {
    if (!drag) return
    if (Date.now() - drag.started > 15_000) { endDrag(true); return }
    const cursor = screen.getCursorScreenPoint()
    const dx = cursor.x - drag.cursor.x
    const dy = cursor.y - drag.cursor.y
    if (Math.hypot(dx, dy) > 4) drag.moved = true
    if (drag.moved) pet.setPosition(Math.round(drag.origin.x + dx), Math.round(drag.origin.y + dy), false)
  }, 16)
  broadcast()
}

async function loadCharacter(simulateFailure = false) {
  try {
    if (simulateFailure) throw new Error('模拟素材缺失')
    character = parseCharacter(JSON.parse(await readFile(join(app.getAppPath(), 'resources/character/prototype.json'), 'utf8')))
    assetError = null
  } catch {
    character = null
    assetError = '角色素材未能加载。可以恢复测试角色，或从托盘打开控制台。'
  }
  clearTimeout(actionTimer)
  action = 'idle'
  actionToken++
  if (pet?.webContents.isCrashed()) loadView(pet, 'pet')
  broadcast()
}

function secureWindow(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.on('render-process-gone', () => {
    if (window === pet && !quitting) {
      endDrag(true)
      passthrough(true)
      openPanel()
    }
  })
}
function loadView(window: BrowserWindow, view: 'pet' | 'panel') {
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/?view=${view}`)
  else void window.loadFile(join(here, '../renderer/index.html'), { query: { view } })
}
function openPanel() {
  if (idleBenchmark) return
  if (quitting) return
  if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); return }
  panel = new BrowserWindow({
    width: 1000, height: 740, minWidth: 860, minHeight: 650, show: false,
    title: 'Table Pet TB · 原型控制台', backgroundColor: '#f7f8f3', autoHideMenuBar: true,
    icon: join(app.getAppPath(), 'resources/tray.png'),
    webPreferences: { preload: join(here, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  secureWindow(panel)
  panel.once('ready-to-show', () => { panel?.show(); panel?.focus() })
  panel.on('closed', () => { panel = null })
  loadView(panel, 'panel')
}
function updateTray() {
  trayMenu = Menu.buildFromTemplate([
    { label: '打开原型控制台', click: openPanel },
    { label: '找回桌宠 / 重置位置', click: () => { endDrag(true); place(); pet.showInactive() } },
    { label: '恢复测试角色', click: () => void loadCharacter() },
    { type: 'separator' },
    { label: '保持在最前', type: 'checkbox', checked: settings.alwaysOnTop, click: item => void dispatch({ type: 'set-top', value: item.checked }) },
    { label: '安静展示', type: 'checkbox', checked: settings.quiet, click: item => void dispatch({ type: 'set-quiet', value: item.checked }) },
    { type: 'separator' },
    { label: '退出桌宠', click: () => app.quit() }
  ])
  tray?.setContextMenu(trayMenu)
}
async function dispatch(command: Command): Promise<{ ok: boolean; error?: string }> {
  switch (command.type) {
    case 'action': return play(command.action)
    case 'panel': openPanel(); break
    case 'reset-position': endDrag(true); place(); pet.showInactive(); break
    case 'set-top': settings.alwaysOnTop = command.value; pet.setAlwaysOnTop(command.value, 'floating'); persist(); updateTray(); broadcast(); break
    case 'set-quiet': settings.quiet = command.value; persist(); updateTray(); broadcast(); break
    case 'reload-character': await loadCharacter(command.simulateFailure); break
    case 'quit': app.quit(); break
  }
  return { ok: true }
}

async function recordMetrics() {
  if (!benchmarkDir || !pet || pet.isDestroyed()) return
  const processes = app.getAppMetrics().map(p => ({ pid: p.pid, type: p.type, cpu: p.cpu.percentCPUUsage, memory: p.memory }))
  await appendFile(join(benchmarkDir, 'metrics.jsonl'), JSON.stringify({
    time: Date.now(), processes, fps: reportedFps,
    windowCount: BrowserWindow.getAllWindows().length, action, idleBenchmark,
    cpuPercentSum: processes.reduce((n, p) => n + p.cpu, 0),
    workingSetMB: processes.reduce((n, p) => n + p.memory.workingSetSize / 1024, 0)
  }) + '\n')
}

if (!testMode && !app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', openPanel)
  void app.whenReady().then(async () => {
    app.setAppUserModelId('local.tablepet.tb')
    settings = await readSettings(settingsPath)
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      // No external services in P00. Development only permits its own Vite origin.
      const devOrigin = process.env.ELECTRON_RENDERER_URL
      const local = devOrigin && (details.url.startsWith(devOrigin + '/') || details.url.startsWith(devOrigin.replace(/^http/, 'ws') + '/'))
      callback({ cancel: /^https?:|^wss?:/.test(details.url) && !local })
    })
    const position = clampToDisplays(settings.position, PET_SIZE, areas())
    pet = new BrowserWindow({
      ...PET_SIZE, ...position, frame: false, transparent: true, backgroundColor: '#00000000',
      show: false, resizable: false, maximizable: false, minimizable: false, hasShadow: false, thickFrame: false,
      skipTaskbar: true, focusable: false, alwaysOnTop: settings.alwaysOnTop,
      title: 'Table Pet TB · 小芽',
      webPreferences: { preload: join(here, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: true }
    })
    secureWindow(pet)
    pet.setIgnoreMouseEvents(true, { forward: true })
    pet.once('ready-to-show', () => pet.showInactive())
    pet.on('close', event => { if (!quitting) { event.preventDefault(); pet.hide() } })
    const trusted = (id: number) => [pet, panel].some(w => w && !w.isDestroyed() && w.webContents.id === id)
    ipcMain.handle('tb:snapshot', event => { if (!trusted(event.sender.id)) throw new Error('Unknown window'); return snapshot() })
    ipcMain.handle('tb:command', (event, value: unknown) => {
      if (!trusted(event.sender.id) || !isCommand(value)) return { ok: false, error: '无效的操作请求。' }
      return dispatch(value)
    })
    ipcMain.on('tb:interactive', (event, value: unknown) => { if (event.sender === pet.webContents && typeof value === 'boolean' && !drag) passthrough(!value) })
    ipcMain.on('tb:drag-start', event => { if (event.sender === pet.webContents) beginDrag() })
    ipcMain.on('tb:drag-end', event => { if (event.sender === pet.webContents) endDrag() })
    ipcMain.on('tb:fps', (event, value: unknown) => { if (event.sender === pet.webContents && typeof value === 'number' && value > 0 && value < 1000) reportedFps = value })
    ipcMain.on('tb:ready', event => {
      if (event.sender !== pet.webContents || readyRecorded) return
      readyRecorded = true
      if (benchmarkDir) void writeFile(join(benchmarkDir, 'ready.json'), JSON.stringify({ time: Date.now(), pid: process.pid, displays: snapshot().displays }))
    })
    if (benchmarkDir) await mkdir(benchmarkDir, { recursive: true })
    await loadCharacter()
    tray = new Tray(nativeImage.createFromPath(join(app.getAppPath(), 'resources/tray.png')))
    tray.setToolTip('Table Pet TB · 点击打开原型控制台')
    tray.on('click', openPanel)
    updateTray()
    loadView(pet, 'pet')
    // Windows may stop forwarding mouse moves after a transparent window is recreated.
    // Probe only this window's area; no desktop pixels or input history are collected.
    pointerTimer = setInterval(() => {
      if (drag || pet.isDestroyed() || !pet.isVisible()) return
      const cursor = screen.getCursorScreenPoint()
      const bounds = pet.getContentBounds()
      const x = cursor.x - bounds.x, y = cursor.y - bounds.y
      if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) passthrough(true)
      else pet.webContents.send('tb:pointer-probe', { x, y })
    }, 50)
    const recover = () => { endDrag(true); place(settings.position) }
    screen.on('display-removed', recover)
    screen.on('display-metrics-changed', recover)
    if (benchmarkDir) metricsTimer = setInterval(() => void recordMetrics().catch(console.error), 10_000)
    if (!process.argv.includes('--pet-only')) openPanel()
    if (testMode) Object.assign(globalThis, { __tbTest: { snapshot, dispatch, place, openPanel, pet: () => pet, trayMenu: () => trayMenu } })
    const quitAfter = Number(process.argv.find(arg => arg.startsWith('--quit-after-ms='))?.split('=')[1])
    if (Number.isFinite(quitAfter) && quitAfter > 0) setTimeout(() => app.quit(), quitAfter)
  }).catch(error => { console.error(error); app.exit(1) })
}

app.on('window-all-closed', () => { /* A tray app stays alive when its control panel closes. */ })
app.on('before-quit', event => {
  if (quitting) return
  event.preventDefault()
  endDrag(true)
  quitting = true
  clearTimeout(actionTimer); clearTimeout(saveTimer); clearInterval(dragTimer); clearInterval(metricsTimer); clearInterval(pointerTimer)
  const finish = async () => {
    await writeQueue
    await writeSettings(settingsPath, settings)
    if (benchmarkDir) await recordMetrics()
  }
  void finish().catch(console.error).finally(() => { tray?.destroy(); app.quit() })
})
