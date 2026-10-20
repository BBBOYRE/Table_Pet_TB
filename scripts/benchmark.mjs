import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import electron from 'electron'

const root = resolve('.local/verification/benchmark')
const duration = Number(process.argv.find(arg => arg.startsWith('--duration='))?.split('=')[1] ?? 620000)
const env = { ...process.env, TB_TEST_MODE: '1', TB_BENCHMARK_IDLE: '1' }
delete env.ELECTRON_RUN_AS_NODE
async function run(name, ms) {
  const output = join(root, `${name}-${Date.now()}`)
  await mkdir(output, { recursive: true })
  const started = Date.now()
  const gpu = ms > 10000 && process.platform === 'win32' ? spawn('powershell.exe', ['-NoProfile', '-File', resolve('scripts/sample-gpu.ps1'), '-Directory', output], { windowsHide: true, stdio: 'ignore' }) : null
  const gpuDone = gpu && new Promise(accept => { gpu.on('exit', accept); gpu.on('error', accept) })
  const child = spawn(electron, ['.', '--pet-only', `--quit-after-ms=${ms}`], {
    env: { ...env, TB_DATA_DIR: join(output, 'profile'), TB_BENCHMARK_DIR: output }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  const timer = setInterval(() => console.log(`${name}: ${Math.round((Date.now() - started) / 1000)} seconds`), 60000)
  await new Promise((accept, reject) => { child.on('error', reject); child.on('exit', code => code === 0 ? accept() : reject(new Error(`Electron exited ${code}: ${stderr}`))) }).finally(async () => { clearInterval(timer); await writeFile(join(output, 'stop-gpu'), ''); await gpuDone })
  const ready = JSON.parse(await readFile(join(output, 'ready.json'), 'utf8'))
  return { output, startupMs: ready.time - started, displays: ready.displays }
}
const startups = []
for (let i = 0; i < 5; i++) {
  const result = await run(`startup-${i + 1}`, 1600)
  startups.push(result.startupMs)
  console.log(`startup ${i + 1}: ${result.startupMs} ms`)
}
const idle = await run('idle', duration)
const metrics = (await readFile(join(idle.output, 'metrics.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
if (metrics.some(m => m.windowCount !== 1 || m.action !== 'idle' || !m.idleBenchmark)) throw new Error('Idle workload changed; this run is not a valid idle baseline.')
const steady = metrics.slice(1)
const mean = values => values.reduce((a, b) => a + b, 0) / values.length
let gpu = []
try { gpu = (await readFile(join(idle.output, 'gpu.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line)) } catch { console.warn('GPU counters unavailable; record this verification gap.') }
const summary = {
  recordedAt: new Date().toISOString(), startupsMs: startups,
  startupMedianMs: [...startups].sort((a, b) => a - b)[2],
  idleDurationSeconds: (metrics.at(-1).time - metrics[0].time) / 1000,
  sampleCount: metrics.length, cpuPercentSumMean: mean(steady.map(m => m.cpuPercentSum)),
  workload: 'one-pet-window-idle-locked',
  workingSetMBMean: mean(steady.map(m => m.workingSetMB)),
  workingSetMBMax: Math.max(...steady.map(m => m.workingSetMB)),
  workingSetMBFirst: steady[0]?.workingSetMB, workingSetMBLast: steady.at(-1)?.workingSetMB,
  fpsMean: mean(steady.filter(m => m.fps > 0).map(m => m.fps)),
  gpuSamples: gpu.length,
  gpuBusiestEngineMeanPercent: gpu.length ? mean(gpu.map(m => m.busiestEnginePercent)) : null,
  gpuBusiestEngineMaxPercent: gpu.length ? Math.max(...gpu.map(m => m.busiestEnginePercent)) : null,
  displays: idle.displays, rawDirectory: idle.output
}
await writeFile(join(root, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
