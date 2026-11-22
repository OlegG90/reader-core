import { describe, expect, it } from 'vitest'
import { isTap, tapZone } from './touch'

describe('touch', () => {
  it('tells taps from swipes and long presses', () => {
    const start = { x: 100, y: 100, time: 0 }
    expect(isTap(start, { x: 104, y: 97, time: 150 })).toBe(true)
    expect(isTap(start, { x: 160, y: 100, time: 150 })).toBe(false)
    expect(isTap(start, { x: 100, y: 100, time: 900 })).toBe(false)
  })

  it('splits the page into thirds', () => {
    expect(tapZone(10, 400)).toBe('prev')
    expect(tapZone(200, 400)).toBe('menu')
    expect(tapZone(390, 400)).toBe('next')
  })
})
