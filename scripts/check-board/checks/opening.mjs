// The normal start of a table, not the debug one: the host starts it, the board loads behind the platform's start screen, the others say they are ready and the viewer presses "I'm here". What the page draws from that press is recorded, to
// see the opening of the game (the first deal, the camera's entrance).
import { clickButton, findButton } from "../probe.mjs"
import { runCheck } from "../run.mjs"
import { waitFor } from "../util.mjs"

export async function opening(ctx, seats) {
  return runCheck(ctx, { check: "opening", seats }, async (env) => {
    const table = await env.table()
    // A table that fills begins by itself: the host has nothing to start
    const lobby = await table.state(0)
    env.result.data.beganWhenFull = lobby.status !== "lobby"
    if (lobby.status === "lobby") {
      const started = await table.request(0, "POST", `/${table.code}/start`, {})
      if (started.http !== 200) throw new Error(`the host's start → ${started.http} ${started.error ?? ""}`)
    }
    const starting = await table.state(0)
    if (starting.status !== "starting") throw new Error(`after the start the table is "${starting.status}", expected "starting" (the ready check)`)

    const page = await env.board(table, { wait: false })
    // The start screen: its button appears once this board has loaded
    const button = await waitFor(() => page.eval(findButton, "I'm here"), { timeoutMs: 60_000, everyMs: 300 })
    if (!button) throw new Error("the start screen never offered its \"I'm here\" button within a minute (is the board loaded? the page says: no button)")
    const timing = (await table.state(0)).readyInMs
    // The others are ready; the viewer is the last, so their press begins the game
    for (let i = 1; i < seats; i++) {
      const ready = await table.request(i, "POST", `/${table.code}/ready`, {})
      if (ready.http !== 200) throw new Error(`${table.names[i]} is ready → ${ready.http} ${ready.error ?? ""}`)
    }
    let pressed = null
    const recorded = await env.record(
      page,
      `opening-${seats}p`,
      async () => {
        pressed = await page.eval(clickButton, "I'm here")
      },
      { seconds: 9, step: 0.38, lead: 0.1 },
    )
    if (!pressed) throw new Error("the \"I'm here\" button went away before it was pressed")
    const began = await waitFor(async () => ((await table.state(0)).status === "playing" ? true : null), { timeoutMs: 20_000, everyMs: 400 })
    const after = await table.state(0)
    if (!began) throw new Error(`the viewer pressed "${pressed}" and the table is "${after.status}" 20 s later, not playing`)
    env.result.data = { ...env.result.data, buttonText: pressed, readyInMsWhenSeen: timing, frames: recorded.frames, statusAfter: after.status }
  })
}
