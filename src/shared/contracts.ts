export const ACTIONS = ['idle', 'greet', 'happy', 'thinking'] as const
export type PetAction = typeof ACTIONS[number]
export type Bounds = { x: number; y: number; width: number; height: number }
export type Point = { x: number; y: number }
export type Settings = { version: 1; position?: Point; alwaysOnTop: boolean; quiet: boolean }
export type Character = {
  id: string
  name: string
  description: string
  renderer: 'svg-prototype'
  actions: PetAction[]
}
export type Snapshot = {
  version: string
  character: Character | null
  assetError: string | null
  action: PetAction
  actionToken: number
  settings: Settings
  petBounds: Bounds
  displays: { id: number; scaleFactor: number; workArea: Bounds }[]
  dragging: boolean
  mousePassthrough: boolean
}
export type Command =
  | { type: 'action'; action: PetAction }
  | { type: 'panel' }
  | { type: 'reset-position' }
  | { type: 'set-top'; value: boolean }
  | { type: 'set-quiet'; value: boolean }
  | { type: 'reload-character'; simulateFailure?: boolean }
  | { type: 'quit' }
export type PetBridge = {
  snapshot: () => Promise<Snapshot>
  command: (command: Command) => Promise<{ ok: boolean; error?: string }>
  setInteractive: (interactive: boolean) => void
  beginDrag: () => void
  endDrag: () => void
  rendererReady: () => void
  reportFrameRate: (fps: number) => void
  subscribe: (callback: (state: Snapshot) => void) => () => void
  onPointerProbe: (callback: (point: Point) => void) => () => void
}

declare global {
  interface Window { pet: PetBridge }
}
