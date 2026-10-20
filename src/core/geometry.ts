import type { Bounds, Point } from '../shared/contracts.ts'

export function clampToDisplays(point: Point | undefined, size: { width: number; height: number }, areas: Bounds[]): Point {
  const fallback = areas[0] ?? { x: 0, y: 0, width: 1280, height: 720 }
  const safe = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point : undefined
  const area = safe ? areas.reduce((best, current) => {
    const distance = (a: Bounds) => Math.hypot(
      safe.x - Math.max(a.x, Math.min(safe.x, a.x + a.width - size.width)),
      safe.y - Math.max(a.y, Math.min(safe.y, a.y + a.height - size.height))
    )
    return distance(current) < distance(best) ? current : best
  }, fallback) : fallback
  return {
    x: Math.round(Math.max(area.x, Math.min(safe?.x ?? area.x + area.width - size.width - 36, area.x + Math.max(0, area.width - size.width)))),
    y: Math.round(Math.max(area.y, Math.min(safe?.y ?? area.y + area.height - size.height - 22, area.y + Math.max(0, area.height - size.height))))
  }
}
