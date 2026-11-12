// A table that is reloaded in the middle of a game: the board draws again, the cards are where they lie, and none flies in again. A few moves are played through the API, the board is opened and left to settle, then reloaded with a screencast
// running; the seconds from the moment the board is shown again are the sheet, and how much the canvas changes in them while the camera stands still is measured (the camera's own entrance moves everything, cards that fly in move only themselves).
import { boardDrawn, boardRevealed, readScene, sampleCanvas } from "../probe.mjs"
import { runCheck } from "../run.mjs"
import { maxDiff, meanDiff, sleep, waitFor } from "../util.mjs"

/** How much the canvas may change from one look to the next while the camera stands still, in grey levels on average, before it is reported as something moving: a glow that pulses stays well under it, a card in flight is well over */
const STILL = 1

export async function reload(ctx, seats) {
  return runCheck(ctx, { check: "reload", seats }, async (env) => {
    const { config, args } = ctx
    const table = await env.table()
    await table.start()
    // a few moves, so that there is something on the table
    for (let n = 0; n < (config.warm ?? 6); n++) {
      const s = await table.state(0)
      if (s.status !== "playing") break
      const who = table.waitedFor(s)
      if (who >= 0) await table.play(who, { state: who === 0 ? s : null })
    }
    const page = await env.board(table)
    const version = (await table.state(0)).version

    await page.startScreencast({ width: args.viewport[0], height: args.viewport[1] })
    const t0 = Date.now()
    await page.reload()
    const back = await waitFor(
      async () => {
        const seen = await page.eval(boardDrawn)
        return seen.canvas && seen.scene ? seen : null
      },
      { timeoutMs: 120_000, everyMs: 300 },
    )
    const drawnAt = Date.now()
    const shown = back && (await waitFor(() => page.eval(boardRevealed), { timeoutMs: 90_000, everyMs: 200 }))
    const shownAt = Date.now()
    if (!shown) {
      await page.stopScreencast()
      throw new Error(back ? "after the reload the board drew but was never shown (the platform's screen stayed over it)" : "after the reload the board never drew again")
    }
    // How much the canvas changes in the three seconds after the board is shown, a look every 200 ms, counting only the looks between which the camera did not move
    const steps = []
    let moving = 0
    let before = { scene: await page.eval(readScene), pixels: await page.eval(sampleCanvas) }
    for (let k = 0; k < 15; k++) {
      await sleep(200)
      const now = { scene: await page.eval(readScene), pixels: await page.eval(sampleCanvas) }
      const still = before.scene.ok && now.scene.ok && maxDiff([...before.scene.camera.view, ...before.scene.camera.projection], [...now.scene.camera.view, ...now.scene.camera.projection]) < 1e-4
      if (still) steps.push(meanDiff(before.pixels, now.pixels))
      else moving++
      before = now
    }
    const frames = await page.stopScreencast()
    if (frames.length === 0) throw new Error("the page painted no frame after the reload")
    const picked = []
    for (let k = 0; k < 9; k++) {
      const at = shownAt - 400 + k * 330
      picked.push((frames.filter((frame) => frame.t <= at).at(-1) ?? frames[0]).data)
    }
    await env.sheet(`reload-${seats}p`, picked, { columns: 3 })
    const loudest = steps.length ? Math.max(...steps) : 0
    const round = (v) => Math.round(v * 100) / 100
    env.result.data = { drawnAfterMs: drawnAt - t0, shownAfterMs: shownAt - t0, frames: frames.length, version, looksWithCameraStill: steps.length, looksWithCameraMoving: moving, loudestStep: round(loudest), steps: steps.map(round) }
    if (loudest > STILL) env.warn(`the canvas kept changing after the reload while the camera stood still (a step of ${round(loudest)} grey levels, more than ${STILL}): look at reload-${seats}p.png for cards that fly in again`)
    const after = (await table.state(0)).version
    if (after !== version) env.fail(`the table moved (version ${version} to ${after}) while it was only reloaded`)
  })
}
