/** Refetch throttle for SSE events: a module rewrites a running job's record every couple of seconds, and refetching a
 *  big list on every change hangs the page. `soon(key, ms, fn)` runs fn once, ms after the first event of a window;
 *  later events of the window are covered by that run (the last state is always fetched). */
export function throttler() {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  return {
    soon(key: string, ms: number, fn: () => void) {
      if (timers.has(key)) return
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key)
          fn()
        }, ms),
      )
    },
    clear() {
      timers.forEach(clearTimeout)
      timers.clear()
    },
  }
}

/** Windows: lists (heavy, every running job changes them) and one open item. */
export const REFETCH_MS = { list: 8000, item: 2500, small: 3000 }
