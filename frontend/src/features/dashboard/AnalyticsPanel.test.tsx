import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalyticsPanel } from './AnalyticsPanel'
import type { AttendanceTrendPoint, OvertimeTrendPoint, ShiftCoveragePoint } from './types'

/**
 * Proves the Bklit charts actually draw.
 *
 * `test/setup.ts` installs a no-op `ResizeObserver` so component tests don't
 * crash on visx — but visx's `useParentSize` starts at 0×0 and only leaves it
 * when the observer reports a box, so under that stub every chart renders an
 * empty container. That is invisible in a test that only asserts on text, and
 * it is exactly the failure mode that hid a blank chart during manual review.
 *
 * This file swaps in an observer that reports a real size the moment it is
 * asked to observe something, then asserts on the emitted SVG geometry.
 */

const SIZE = { width: 720, height: 280 }

class ReportingResizeObserver {
  // A plain field rather than a parameter property: `erasableSyntaxOnly` is on
  // in tsconfig, which rules out constructor parameter properties.
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    const contentRect = { ...SIZE, top: 0, left: 0, bottom: SIZE.height, right: SIZE.width, x: 0, y: 0 }
    this.callback(
      [{ target, contentRect } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    )
  }

  unobserve() {}
  disconnect() {}
}

function days(count: number, from = new Date('2026-07-10T00:00:00Z')): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

const ATTENDANCE: AttendanceTrendPoint[] = days(10).map((date, i) => ({
  date,
  present: 20 + (i % 4),
  late: 2 + (i % 3),
  absent: 1,
  leave: 1,
  holiday: 0,
  overtime: 0,
}))

const OVERTIME: OvertimeTrendPoint[] = days(10).map((date, i) => ({
  date,
  overtimeHours: 1 + (i % 5) * 0.5,
}))

const COVERAGE: ShiftCoveragePoint[] = days(10).map((date, i) => ({
  date,
  shiftCount: 3,
  requiredStaff: 9,
  assignedStaff: i % 3 === 0 ? 7 : 9,
  coveragePercent: i % 3 === 0 ? 77.78 : 100,
}))

function renderPanel(overrides: Partial<Parameters<typeof AnalyticsPanel>[0]> = {}) {
  return render(
    <AnalyticsPanel
      attendance={ATTENDANCE}
      overtime={OVERTIME}
      coverage={COVERAGE}
      isLoading={false}
      windowDays={30}
      upcomingWindowDays={14}
      {...overrides}
    />,
  )
}

/**
 * Path elements carrying real chart geometry — the proof a series was actually
 * drawn. Excludes heroicons: the tab triggers render them (also `<path d="…">`
 * with long geometry) regardless of chart state, so counting all paths
 * overcounts even when no series is drawn. Every heroicon ships a fixed
 * `viewBox="0 0 24 24"`, which the chart's own SVG (sized to its measured
 * pixel dimensions) never coincidentally matches — a more reliable signal
 * here than `aria-hidden`, since the chart SVG is `aria-hidden` too.
 */
function drawnPaths(container: HTMLElement): SVGPathElement[] {
  return [...container.querySelectorAll('path')].filter((p) => {
    if ((p.getAttribute('d') ?? '').length <= 20) return false
    const svg = p.closest('svg')
    return svg?.getAttribute('viewBox') !== '0 0 24 24'
  }) as SVGPathElement[]
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ReportingResizeObserver)
})

describe('AnalyticsPanel', () => {
  it('draws the attendance series as real SVG geometry', async () => {
    const { container } = renderPanel()

    await waitFor(() => expect(drawnPaths(container).length).toBeGreaterThan(0))

    // Two series on this tab — present and late — so at least two drawn paths.
    expect(drawnPaths(container).length).toBeGreaterThanOrEqual(2)
  })

  it('redraws when the series is switched', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel()

    await waitFor(() => expect(drawnPaths(container).length).toBeGreaterThan(0))

    await user.click(screen.getByRole('tab', { name: /Coverage/ }))

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Coverage/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(drawnPaths(container).length).toBeGreaterThan(0)
  })

  it('states the headline total for the selected series', async () => {
    const user = userEvent.setup()
    renderPanel()

    // Attendance: sum of present + late across the fixture.
    const attended = ATTENDANCE.reduce((sum, p) => sum + p.present + p.late, 0)
    expect(screen.getByText(attended.toLocaleString())).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Overtime/ }))
    const hours = OVERTIME.reduce((sum, p) => sum + p.overtimeHours, 0)
    expect(await screen.findByText(hours.toFixed(1))).toBeInTheDocument()
  })

  it('shows an explanatory empty state instead of an empty chart frame', () => {
    const { container } = renderPanel({ attendance: [], overtime: [], coverage: [] })

    expect(screen.getByText('Not enough data to chart')).toBeInTheDocument()
    expect(screen.getByText('No attendance was recorded in this window.')).toBeInTheDocument()
    expect(drawnPaths(container)).toHaveLength(0)
  })

  it('renders a skeleton, not a chart, while loading', () => {
    const { container } = renderPanel({ isLoading: true })

    expect(drawnPaths(container)).toHaveLength(0)
    expect(screen.queryByText('Not enough data to chart')).not.toBeInTheDocument()
  })
})
