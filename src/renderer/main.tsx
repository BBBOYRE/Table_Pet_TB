import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Character } from './Character'
import type { Command, PetAction, Snapshot } from '../shared/contracts'
import './style.css'

const view = new URLSearchParams(location.search).get('view') === 'pet' ? 'pet' : 'panel'
document.documentElement.dataset.view = view
document.title = view === 'pet' ? 'Table Pet TB · 小芽' : 'Table Pet TB · 原型控制台'

function useSnapshot() {
  const [state, setState] = useState<Snapshot | null>(null)
  useEffect(() => {
    const unsubscribe = window.pet.subscribe(setState)
    void window.pet.snapshot().then(setState)
    return unsubscribe
  }, [])
  return state
}

function PetWindow() {
  const state = useSnapshot()
  const dragging = useRef(false)
  useEffect(() => {
    let interactive = false
    const move = (event: MouseEvent) => {
      const hit = !!document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-interactive]')
      if (hit !== interactive) { interactive = hit; window.pet.setInteractive(hit) }
    }
    const leave = (event: MouseEvent) => { if (!event.relatedTarget && !dragging.current) { interactive = false; window.pet.setInteractive(false) } }
    const release = () => { if (dragging.current) { dragging.current = false; window.pet.endDrag() } }
    const stopProbe = window.pet.onPointerProbe(point => {
      if (dragging.current) return
      interactive = !!document.elementFromPoint(point.x, point.y)?.closest('[data-interactive]')
      window.pet.setInteractive(interactive)
    })
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseout', leave)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => { stopProbe(); window.removeEventListener('mousemove', move); window.removeEventListener('mouseout', leave); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release) }
  }, [])
  useEffect(() => {
    if (state) window.pet.rendererReady()
  }, [!!state])
  useEffect(() => {
    let frame = 0
    let disposed = false
    const sample = () => {
      let count = 0
      const start = performance.now()
      const tick = () => {
        if (disposed) return
        count++
        if (performance.now() - start < 1500) frame = requestAnimationFrame(tick)
        else window.pet.reportFrameRate(count * 1000 / (performance.now() - start))
      }
      frame = requestAnimationFrame(tick)
    }
    sample()
    const interval = setInterval(sample, 15_000)
    return () => { disposed = true; clearInterval(interval); cancelAnimationFrame(frame) }
  }, [])
  if (!state) return null
  const lines = { idle: '我在这里，慢慢来就好。', greet: '你好呀，今天也请多关照。', happy: '收到！为你开心一下。', thinking: '嗯……让我想一想。' }
  return <main className="pet-stage" data-testid="pet-stage" data-action={state.action} data-error={!!state.assetError}>
    {!state.settings.quiet && <div className="pet-bubble">{state.assetError ? '角色走丢了，点这里找回来。' : lines[state.action]}</div>}
    <div className="pet-drawing" onPointerDown={event => {
      if (event.button !== 0 || !(event.target as Element).closest('[data-interactive]')) return
      event.preventDefault()
      dragging.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      window.pet.beginDrag()
    }} onDoubleClick={() => void window.pet.command({ type: 'panel' })} onContextMenu={event => { event.preventDefault(); void window.pet.command({ type: 'panel' }) }}>
      {state.character ? <Character action={state.action} token={state.actionToken} interactive /> : <button className="fallback" data-interactive onClick={() => void window.pet.command({ type: 'reload-character' })} aria-label="恢复测试角色">✦<span>恢复角色</span></button>}
    </div>
    <button className="pet-open" data-interactive onClick={() => void window.pet.command({ type: 'panel' })} aria-label="打开原型控制台">···</button>
  </main>
}

const actionLabels: Record<PetAction, string> = { idle: '自在待机', greet: '向你问好', happy: '开心一下', thinking: '认真思考' }
function ControlPanel() {
  const state = useSnapshot()
  const [tab, setTab] = useState<'home' | 'check'>('home')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState('')
  async function command(value: Command) {
    const result = await window.pet.command(value)
    setMessage(result.ok ? '' : result.error ?? '操作未完成')
  }
  if (!state) return <div className="loading">正在唤醒小芽…</div>
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✦</span><div>Table Pet<span>一隅陪伴 · TB</span></div></div>
      <div className="nav-label">我的桌面</div>
      <button className={`nav-item ${tab === 'home' ? 'selected' : ''}`} onClick={() => setTab('home')}><span>⌂</span> 陪伴空间</button>
      <button className={`nav-item ${tab === 'check' ? 'selected' : ''}`} onClick={() => setTab('check')}><span>◇</span> 原型检查</button>
      <div className="sidebar-bottom"><span className="online-dot"/> 本地运行<div>不需要 API，也没有后台云端请求。</div><span className="version">P00 / v{state.version}</span></div>
    </aside>
    <main className="content">
      <header><div className="eyebrow">A LITTLE COMPANY, EVERY DAY</div><span className="phase">技术原型 · P00</span></header>
      {tab === 'home' ? <>
        <h1>给桌面，添一点陪伴。</h1>
        <p className="subtitle">先从一个小小的问候开始。小芽已经在你的桌面等你。</p>
        <section className="companion-card">
          <div className="preview"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><div className="preview-art">{state.character ? <Character action={state.action} token={state.actionToken}/> : <span className="preview-fallback">✦</span>}</div><span className="preview-caption">二维自绘 · 动态测试角色</span></div>
          <div className="companion-info"><span className="small-tag">你的桌面伙伴</span><h2>{state.character?.name ?? '角色暂时离线'}<span>Sprout</span></h2>
            <p>{state.assetError ?? '一颗住在桌面的小芽。会眨眼、会问好，也会安静地陪你待一会儿。'}</p>
            <div className="status-line"><span className="online-dot"/>{state.assetError ? '等待恢复' : actionLabels[state.action]}</div>
            <button className="primary" onClick={() => void command({ type: state.assetError ? 'reload-character' : 'action', action: 'greet' } as Command)}>{state.assetError ? '恢复测试角色' : '和小芽打个招呼'} <span>↗</span></button>
            <span className="hint">拖动桌面角色移动 · 双击或右键打开此窗口</span>
          </div>
        </section>
        <section className="section-heading"><h3>试试这些小动作</h3><span>动作在本地播放</span></section>
        <div className="actions">{(['idle', 'greet', 'happy', 'thinking'] as const).map((a, i) => <button key={a} className={`action-card ${state.action === a ? 'active' : ''}`} disabled={!state.character} onClick={() => void command({ type: 'action', action: a })}><span className="action-icon">{['☁', '✋', '✧', '…'][i]}</span><span>{actionLabels[a]}</span></button>)}</div>
        <div className="settings-row"><Toggle label="保持在最前" description="让桌宠留在其他窗口上方" checked={state.settings.alwaysOnTop} onChange={value => void command({ type: 'set-top', value })}/><Toggle label="安静展示" description="收起气泡，保留动作陪伴" checked={state.settings.quiet} onChange={value => void command({ type: 'set-quiet', value })}/></div>
        <footer><span>当前为验证原型，正式人设、聊天与养成模式将在后续阶段加入。</span><button onClick={() => void command({ type: 'reset-position' })}>找回桌宠 ↗</button></footer>
      </> : <>
        <h1>让每个小动作，都稳稳当当。</h1><p className="subtitle">这里用于验证窗口、动作与恢复流程，不会发送你的输入。</p>
        <div className="diagnostics"><div><span>渲染方式</span><strong>原创 SVG 动画</strong><small>Live2D 专项尚未验证</small></div><div><span>当前显示器</span><strong>{state.displays.length} 块</strong><small>缩放 {state.displays.map(d => `${d.scaleFactor * 100}%`).join(' / ')}</small></div><div><span>角色坐标</span><strong>{state.petBounds.x}, {state.petBounds.y}</strong><small>位置会保存到用户数据目录</small></div></div>
        <section className="check-card"><h3>窗口与中文输入</h3><p>输入任意文字，检查切换窗口后焦点是否正常。此内容只留在当前输入框。</p><textarea aria-label="中文输入验证" placeholder="例如：你好，小芽。" value={draft} onChange={e => setDraft(e.target.value)}/><div className="check-actions"><button onClick={() => void command({ type: 'reset-position' })}>重置角色位置</button><button onClick={() => void command({ type: 'action', action: 'greet' })}>测试问候动作</button></div></section>
        <section className="check-card"><h3>素材加载与恢复</h3><p>{state.assetError ?? '测试角色已加载。可模拟素材缺失，检查占位提示与恢复入口。'}</p><div className="check-actions"><button onClick={() => void command({ type: 'reload-character', simulateFailure: true })}>模拟素材缺失</button><button onClick={() => void command({ type: 'reload-character' })}>恢复测试角色</button></div></section>
        <footer><span>关闭此窗口后，桌宠仍会在托盘运行。</span><button className="exit" onClick={() => void command({ type: 'quit' })}>退出桌宠</button></footer>
      </>}
      {message && <div className="toast" role="status">{message}</div>}
    </main>
  </div>
}
function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/><span className="switch" aria-hidden="true"/></label>
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  componentDidCatch() { if (view === 'pet') window.pet.setInteractive(false) }
  render() { return this.state.error ? <div className="loading">界面加载失败，请从托盘重新打开控制台。</div> : this.props.children }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary>{view === 'pet' ? <PetWindow/> : <ControlPanel/>}</ErrorBoundary>)
