import { contextBridge, ipcRenderer } from 'electron'
import type { PetBridge, Point, Snapshot } from '../shared/contracts.ts'

const bridge: PetBridge = {
  snapshot: () => ipcRenderer.invoke('tb:snapshot'),
  command: value => ipcRenderer.invoke('tb:command', value),
  setInteractive: value => ipcRenderer.send('tb:interactive', value),
  beginDrag: () => ipcRenderer.send('tb:drag-start'),
  endDrag: () => ipcRenderer.send('tb:drag-end'),
  rendererReady: () => ipcRenderer.send('tb:ready'),
  reportFrameRate: value => ipcRenderer.send('tb:fps', value),
  onPointerProbe: callback => {
    const listener = (_event: Electron.IpcRendererEvent, point: Point) => callback(point)
    ipcRenderer.on('tb:pointer-probe', listener)
    return () => ipcRenderer.removeListener('tb:pointer-probe', listener)
  },
  subscribe: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: Snapshot) => callback(state)
    ipcRenderer.on('tb:state', listener)
    return () => ipcRenderer.removeListener('tb:state', listener)
  }
}
contextBridge.exposeInMainWorld('pet', bridge)
