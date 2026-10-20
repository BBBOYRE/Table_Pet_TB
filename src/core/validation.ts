import { ACTIONS, type Character, type Command, type Settings } from '../shared/contracts.ts'

export const defaults: Settings = { version: 1, alwaysOnTop: true, quiet: false }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function parseSettings(value: unknown): Settings {
  if (!record(value) || value.version !== 1) return { ...defaults }
  const p = value.position
  return {
    ...defaults,
    alwaysOnTop: typeof value.alwaysOnTop === 'boolean' ? value.alwaysOnTop : true,
    quiet: typeof value.quiet === 'boolean' ? value.quiet : false,
    ...(record(p) && typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)
      ? { position: { x: p.x, y: p.y } } : {})
  }
}

export function isCommand(value: unknown): value is Command {
  if (!record(value)) return false
  switch (value.type) {
    case 'action': return ACTIONS.includes(value.action as typeof ACTIONS[number])
    case 'set-top': case 'set-quiet': return typeof value.value === 'boolean'
    case 'reload-character': return value.simulateFailure === undefined || typeof value.simulateFailure === 'boolean'
    case 'panel': case 'reset-position': case 'quit': return true
    default: return false
  }
}

export function parseCharacter(value: unknown): Character {
  if (!record(value) || typeof value.id !== 'string' || typeof value.name !== 'string' ||
      typeof value.description !== 'string' || value.renderer !== 'svg-prototype' ||
      !Array.isArray(value.actions) || !value.actions.includes('idle') ||
      !value.actions.every(action => ACTIONS.includes(action))) {
    throw new Error('角色清单格式不受支持')
  }
  return value as Character
}
