import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clampToDisplays } from '../../src/core/geometry.ts'
import { isCommand, parseCharacter, parseSettings } from '../../src/core/validation.ts'
import { readSettings, writeSettings } from '../../src/main/settings.ts'

const primary = { x: 0, y: 0, width: 1920, height: 1040 }
const left = { x: -1280, y: 120, width: 1280, height: 960 }
const size = { width: 280, height: 340 }
test('keeps a valid negative-coordinate position on the left monitor', () => {
  assert.deepEqual(clampToDisplays({ x: -500, y: 200 }, size, [primary, left]), { x: -500, y: 200 })
})
test('recovers an unplugged display and clamps all of the pet into the work area', () => {
  assert.deepEqual(clampToDisplays({ x: -500, y: 900 }, size, [primary]), { x: 0, y: 700 })
  assert.deepEqual(clampToDisplays({ x: 1800, y: 1000 }, size, [primary]), { x: 1640, y: 700 })
})
test('handles invalid positions, very small displays, and gaps between monitors', () => {
  assert.deepEqual(clampToDisplays({ x: NaN, y: 0 }, size, [primary]), { x: 1604, y: 678 })
  assert.deepEqual(clampToDisplays({ x: 900, y: -99 }, size, [{ x: 10, y: 20, width: 100, height: 100 }]), { x: 10, y: 20 })
  assert.deepEqual(clampToDisplays({ x: -1300, y: -300 }, size, [primary, left]), { x: -1280, y: 120 })
})
test('rejects unsupported actions and malformed tool parameters', () => {
  assert.equal(isCommand({ type: 'action', action: 'greet' }), true)
  for (const invalid of [null, { type: 'exec', command: 'anything' }, { type: 'action', action: 'unknown' }, { type: 'set-top', value: 'false' }]) assert.equal(isCommand(invalid), false)
  assert.throws(() => parseCharacter({ id: 'bad', renderer: 'svg-prototype', actions: ['unknown'] }))
})
test('restores settings, ignores malformed fields, and preserves corrupt files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tablepet-unit-'))
  const path = join(dir, 'settings.json')
  const value = { version: 1 as const, quiet: true, alwaysOnTop: false, position: { x: 100, y: 200 } }
  await writeSettings(path, value)
  assert.deepEqual(await readSettings(path), value)
  await writeFile(path, '{broken')
  assert.equal((await readSettings(path)).quiet, false)
  const backup = (await readdir(dir)).find(name => name.startsWith('settings.json.corrupt-'))!
  assert.equal(await readFile(join(dir, backup), 'utf8'), '{broken')
  assert.equal(parseSettings({ version: 1, position: { x: Infinity, y: 0 }, quiet: 'true' }).position, undefined)
})
