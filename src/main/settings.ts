import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { defaults, parseSettings } from '../core/validation.ts'
import type { Settings } from '../shared/contracts.ts'

export async function readSettings(path: string): Promise<Settings> {
  try { return parseSettings(JSON.parse(await readFile(path, 'utf8'))) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => {})
    }
    return { ...defaults }
  }
}

export async function writeSettings(path: string, value: Settings): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2), 'utf8')
  await rename(`${path}.tmp`, path)
}
