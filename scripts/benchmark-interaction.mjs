import { _electron } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { performance } from 'node:perf_hooks'

const output = resolve(`.local/verification/interaction-${Date.now()}`)
await mkdir(output, { recursive: true })
const env = { ...process.env, TB_TEST_MODE: '1', TB_DATA_DIR: join(output, 'profile'), TB_BENCHMARK_DIR: output }
delete env.ELECTRON_RUN_AS_NODE
const gpu = spawn('powershell.exe', ['-NoProfile', '-File', resolve('scripts/sample-gpu.ps1'), '-Directory', output], { windowsHide: true, stdio: 'ignore' })
const gpuDone = new Promise(accept => { gpu.on('exit', accept); gpu.on('error', accept) })
let application
const responseMs = []
try {
  application = await _electron.launch({ args: ['.'], env })
  const deadline = Date.now() + 60_000
  while (application.windows().length < 2) await new Promise(accept => setTimeout(accept, 50))
  const panel = application.windows().find(page => page.url().includes('view=panel'))
  const pet = application.windows().find(page => page.url().includes('view=pet'))
  await panel.getByRole('heading', { name: '给桌面，添一点陪伴。' }).waitFor()
  let index = 0
  const actions = [['greet', '向你问好'], ['happy', '开心一下'], ['thinking', '认真思考']]
  while (Date.now() < deadline) {
    const [action, label] = actions[index++ % actions.length]
    const started = performance.now()
    await panel.getByRole('button', { name: new RegExp(label) }).click()
    await pet.waitForFunction(value => document.querySelector('[data-testid=pet-stage]')?.getAttribute('data-action') === value, action)
    responseMs.push(performance.now() - started)
    await new Promise(accept => setTimeout(accept, 3000))
  }
} finally {
  await application?.close()
  await writeFile(join(output, 'stop-gpu'), '')
  await gpuDone
}
const metrics = (await readFile(join(output, 'metrics.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse).slice(1)
let gpuMetrics = []
try { gpuMetrics = (await readFile(join(output, 'gpu.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse) } catch { console.warn('GPU counters unavailable.') }
const mean = values => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null
const sorted = [...responseMs].sort((a, b) => a - b)
const summary = {
  actions: responseMs.length, responseMeanMs: mean(responseMs), responseP95Ms: sorted[Math.ceil(sorted.length * .95) - 1],
  cpuPercentSumMean: mean(metrics.map(m => m.cpuPercentSum)), workingSetMBMean: mean(metrics.map(m => m.workingSetMB)),
  workingSetMBMax: Math.max(...metrics.map(m => m.workingSetMB)), rafMean: mean(metrics.map(m => m.fps)),
  gpuSamples: gpuMetrics.length, gpuBusiestEngineMeanPercent: mean(gpuMetrics.map(m => m.busiestEnginePercent)),
  rawDirectory: output
}
await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
