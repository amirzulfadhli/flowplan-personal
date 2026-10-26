import { describe, expect, it } from 'vitest'
import { formatTimer, remainingSeconds } from './bridge'

describe('focus timer display', () => {
  it('derives remaining time from a deadline, including time spent hidden or asleep', () => {
    const timer = { endsAt: 301_000, remainingMs: 300_000 }
    expect(remainingSeconds(timer, 1_000)).toBe(300)
    expect(remainingSeconds(timer, 121_500)).toBe(180)
    expect(remainingSeconds(timer, 900_000)).toBe(0)
  })
  it('keeps a paused timer stable and never displays negative time', () => {
    expect(remainingSeconds({ endsAt: null, remainingMs: 59_001 }, 9_000_000)).toBe(60)
    expect(formatTimer(0)).toBe('00:00')
    expect(formatTimer(59)).toBe('00:59')
    expect(formatTimer(25 * 60)).toBe('25:00')
  })
})
