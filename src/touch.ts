/** Where a touch landed and when (ms). */
export interface Touch {
  x: number
  y: number
  time: number
}

/** A finger that moved further than this (px) swiped rather than tapped. */
const TAP_SLOP_PX = 10
/** A press held longer than this (ms) is not a tap (it may be selecting text). */
const TAP_MAX_MS = 400

/** Whether a touch from `start` to `end` was a tap, not a swipe or a long press. */
export function isTap(start: Touch, end: Touch): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= TAP_SLOP_PX && end.time - start.time <= TAP_MAX_MS
}

export type TapZone = 'prev' | 'menu' | 'next'

/** The page's tap zones: the left third goes back, the right third forward, the middle shows the menu. */
export function tapZone(x: number, width: number): TapZone {
  if (x < width / 3) return 'prev'
  if (x > (width * 2) / 3) return 'next'
  return 'menu'
}
