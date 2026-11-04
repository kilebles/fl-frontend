/** A script handed from «Сценарий» to «Промпты» / «Озвучка» (lives in memory across client navigation). */

type Handoff =
  | { to: "prompts"; scriptId: string; niche?: string; title?: string; at: number }
  | { to: "voice"; scriptId: string; at: number }

let pending: Handoff | null = null
const TTL_MS = 60_000

export function handOff(h: { to: "prompts"; scriptId: string; niche?: string; title?: string } | { to: "voice"; scriptId: string }) {
  pending = { ...h, at: Date.now() } as Handoff
}

/** Read without consuming (effects may run twice in development); expires after a minute. */
export function peekHandoff<T extends Handoff["to"]>(to: T): Extract<Handoff, { to: T }> | null {
  if (!pending || pending.to !== to || Date.now() - pending.at > TTL_MS) return null
  return pending as Extract<Handoff, { to: T }>
}

export function clearHandoff() {
  pending = null
}
