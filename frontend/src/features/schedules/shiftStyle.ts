import type { ShiftType } from '@/features/departments/types'

/**
 * Visual encoding for shift types, per DESIGN.md's Shift Scale Rule: teal,
 * blue, violet mean morning, afternoon, night, in that order, always. Every
 * other shift type (weekend, holiday, on_call, overtime, half_day) is
 * deliberately neutral — the three-colour scale is not a generic categorical
 * palette, and stretching it to eight values would break the rule it exists
 * to keep.
 */
const SCALE: Partial<Record<ShiftType, { dot: string; bg: string; text: string }>> = {
  morning: { dot: 'bg-shift-morning', bg: 'bg-shift-morning/10', text: 'text-shift-morning' },
  afternoon: { dot: 'bg-shift-afternoon', bg: 'bg-shift-afternoon/10', text: 'text-shift-afternoon' },
  night: { dot: 'bg-shift-night', bg: 'bg-shift-night/10', text: 'text-shift-night' },
}

const NEUTRAL = { dot: 'bg-muted-foreground', bg: 'bg-muted', text: 'text-muted-foreground' }

export function shiftTypeStyle(type: ShiftType | string) {
  return SCALE[type as ShiftType] ?? NEUTRAL
}
