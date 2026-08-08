import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query.
 *
 * Use this only when a breakpoint has to change what is *rendered* rather than
 * how it looks — Tailwind's responsive variants are the right tool for styling.
 * The case that needs it: `hidden` is `display: none`, and browsers still
 * download `<img>` sources inside a `display: none` subtree, so hiding a large
 * image with a utility class does not stop a phone paying for it.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect` so the first
 * render already has the right answer and there is no flash of the wrong
 * branch.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // jsdom in tests has matchMedia stubbed off by default; assume the small
    // breakpoint there rather than throwing.
    () => false,
  )
}

/** Tailwind's `lg` breakpoint (64rem / 1024px). */
export const LG_QUERY = '(min-width: 64rem)'
