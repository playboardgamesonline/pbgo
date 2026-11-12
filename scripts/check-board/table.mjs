// A table of a game, driven through its public API: guests that sit at it (each one a cookie jar of its own, so each one is a player), the moves they make, the debug commands that rig it. The viewer, seat 0, is the one whose browser
// the checks open; the other seats exist only here, in Node, and play through the API.
import { sleep } from "./util.mjs"

const NAMES = ["Ada", "Ben", "Cleo", "Dan", "Eve", "Fay", "Gus", "Hal", "Ivy", "Jon", "Kay", "Lou", "Max", "Nia", "Oto", "Pia"]

/** The refusal of a call, as a message that says what was asked and what came back */
function refusal(what, response) {
  const hint = response.error === "DEBUG_DISABLED" ? " (this server refuses the debug commands: the tool needs a development server and never runs against production)" : ""
  return new Error(`${what} → ${response.http} ${response.error ?? ""}${hint}`.trim())
}

/**
 * Opens a table of `slug` with `seats` guests, the host first. `options` are the game's options, set before the others sit down (a table that fills begins by itself, and its options can no longer change). `bot` is what a seat does when it is
 * their move (`bot({ state, me, seat, table })` gives an action, or null to let the engine's debug `turn` play it).
 */
export async function openTable({ base, slug, seats, options = {}, bot = null }) {
  const jars = []
  const names = Array.from({ length: seats }, (_, i) => NAMES[i] ?? `Seat ${i + 1}`)
  const ids = []
  let code = null

  /** A call to the table's API as one of the seats. A call that is told to wait (429) waits and tries again */
  async function request(seat, method, path, body) {
    for (let attempt = 0; ; attempt++) {
      const cookie = Object.entries(jars[seat] ?? {})
        .map(([name, value]) => `${name}=${value}`)
        .join("; ")
      const response = await fetch(`${base}/api/${slug}/games${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      })
      for (const line of response.headers.getSetCookie()) {
        const pair = line.split(";")[0]
        const at = pair.indexOf("=")
        jars[seat] ??= {}
        jars[seat][pair.slice(0, at)] = pair.slice(at + 1)
      }
      const json = await response.json().catch(() => ({}))
      if (response.status === 429 && attempt < 6) {
        await sleep(Math.min(20_000, (Number(response.headers.get("retry-after")) || 2) * 1000 + 250))
        continue
      }
      return { http: response.status, ...json }
    }
  }

  const state = (seat = 0) => request(seat, "GET", `/${code}`)

  const table = {
    slug,
    base,
    seats,
    names,
    ids,
    bot,
    /** The viewer's address of the board of a table that has begun */
    get boardUrl() {
      return `${base}/${slug}/game/${code}`
    },
    get code() {
      return code
    },
    request,
    state,
    /** The cookies of a seat, for a browser that is to sit there as that player */
    cookies: (seat) => Object.entries(jars[seat] ?? {}).map(([name, value]) => ({ name, value })),
    /** A move of a seat; throws when the game refuses it */
    async act(seat, action) {
      const response = await request(seat, "POST", `/${code}/action`, action)
      if (response.http !== 200) throw refusal(`${names[seat]} plays ${JSON.stringify(action)}`, response)
      return response
    },
    /** A debug command of the engine (`GAME.debug`: `turn`, `over`, the game's own) sent by a seat; throws when it is refused */
    async rig(command, seat = 0) {
      const response = await request(seat, "POST", `/${code}/debug`, { command })
      if (response.http !== 200) throw refusal(`debug ${command}`, response)
      return response
    },
    /** Starts the game at once with the seats as they are (the debug route, development only), as the platform would once the players are ready */
    async start() {
      const response = await request(0, "POST", `/${code}/debug`, { command: "start" })
      if (response.http !== 200) throw refusal("debug start", response)
      for (let i = 0; i < seats; i++) ids[i] = (await state(i)).meId
      return response
    },
    /** The seat the game waits for in a state, -1 for nobody */
    waitedFor: (s) => (s.waitingFor?.length ? ids.indexOf(s.waitingFor[0]) : -1),
    /** Plays the move of a seat: what `bot` says, or the engine's `turn` debug command when it says nothing */
    async play(seat, { bot: playing = table.bot, state: known = null } = {}) {
      const mine = known ?? (await state(seat))
      const action = playing ? await playing({ state: mine, me: ids[seat], seat, table }) : null
      if (action) {
        await table.act(seat, action)
        return
      }
      try {
        await table.rig("turn", seat)
      } catch (error) {
        if (/→ 400 INVALID_ACTION/.test(String(error?.message))) {
          throw new Error(`${names[seat]} has to move and nobody can play it: the config has no \`bot\` for the seat and the engine has no \`turn\` debug command (\`GAME.debug.turn\`). Add a \`bot\` to check-board.config.mjs (docs/scripts.md)`)
        }
        throw error
      }
    },
    /**
     * Plays the table on until `until(state, who)` is true, `state` being what the viewer reads and `who` the seat the game waits for (-1: nobody). Whoever the game waits for plays as `play` says; the viewer is played like the others, so the
     * situation asked for is the only one the table stops at.
     */
    async advance({ until, bot: playing = table.bot, max = 400, label = "advance" }) {
      for (let move = 0; move < max; move++) {
        const s = await state(0)
        if (s.http !== 200) throw refusal(`${label}: reading the table`, s)
        const who = table.waitedFor(s)
        if (until(s, who)) return s
        if (s.status === "over") throw new Error(`${label}: the game is over`)
        if (s.status !== "playing") throw new Error(`${label}: the table is "${s.status}", not playing`)
        if (who < 0) {
          await sleep(300)
          continue
        }
        await table.play(who, { bot: playing, state: who === 0 ? s : null })
      }
      throw new Error(`${label}: not there after ${max} moves`)
    },
    /** The seats leave: the last to leave deletes the table, so a check leaves no row behind. Errors are not worth failing for */
    async leaveAll() {
      let left = 0
      for (let i = seats - 1; i >= 0; i--) {
        if (!jars[i]) continue
        try {
          if ((await request(i, "POST", `/${code}/leave`, {})).http === 200) left++
        } catch {
          // the table is gone already, or the server is
        }
      }
      return left
    },
  }

  const first = await request(0, "POST", "", { nickname: names[0] })
  if (first.http !== 200) throw refusal(`opening a table of ${slug}`, first)
  code = first.code
  if (Object.keys(options).length) {
    const set = await request(0, "POST", `/${code}/options`, { options })
    if (set.http !== 200) throw refusal(`setting the options ${JSON.stringify(options)}`, set)
  }
  for (let i = 1; i < seats; i++) {
    const joined = await request(i, "POST", `/${code}/join`, { nickname: names[i] })
    if (joined.http !== 200) throw refusal(`${names[i]} sits down`, joined)
  }
  for (let i = 0; i < seats; i++) ids[i] = (await state(i)).meId
  return table
}
