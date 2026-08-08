import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// React Testing Library only self-registers its cleanup when Vitest runs with
// `globals: true`. This project runs with `globals: false`, so without this the
// previous test's DOM stays mounted and queries start matching two of
// everything.
afterEach(cleanup)

// jsdom ships no matchMedia. `useMediaQuery` needs one; reporting "no match"
// puts components on their small-screen branch, which is the right default for
// component tests.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// jsdom ships no ResizeObserver either, and visx's `useParentSize` — which
// every Bklit chart sits on — constructs one unconditionally. Without this the
// chart throws during mount, React Router's error boundary catches it, and the
// *whole screen* under test unmounts, so a dashboard test fails on an assertion
// about a panel that has nothing to do with charts.
//
// It never fires: jsdom reports zero-size elements regardless, so charts render
// at their fallback size. That is fine — these are behavioural tests, and chart
// geometry is not what they assert on.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom implements no SVG geometry: `getTotalLength` and `getPointAtLength`
// are absent, and this jsdom build does not even expose a global
// `SVGPathElement` to patch — so the prototype is reached through a real
// element instead.
//
// Bklit's stroke helpers (`charts/path-stroke-utils.ts`) call both while
// measuring a series path, so any test that lets a chart actually draw — see
// `AnalyticsPanel.test.tsx`, which supplies a ResizeObserver reporting a real
// box — throws without these. The values are stubs: nothing asserts on measured
// stroke length, only on whether a path with real geometry was emitted.
{
  const pathProto = Object.getPrototypeOf(
    document.createElementNS('http://www.w3.org/2000/svg', 'path'),
  ) as {
    getTotalLength?: () => number
    getPointAtLength?: (distance: number) => { x: number; y: number }
  }

  pathProto.getTotalLength ??= () => 100
  pathProto.getPointAtLength ??= (distance: number) => ({ x: distance, y: 0 })
}
