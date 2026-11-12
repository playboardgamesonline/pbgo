// A player who is away: the other seats do not read the table for a while, the platform sees them away (a seat counts as present for 75 s after it last read the table), and the board stays open as the viewer's. The board must go on
// working: it draws, nothing throws, and the page says what it says about the players who are away.
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { boardDrawn, clickButton, findButton, pageText } from "../probe.mjs"
import { runCheck } from "../run.mjs"
import { sleep, waitFor } from "../util.mjs"

export async function absent(ctx, seats) {
  return runCheck(ctx, { check: "absent", seats, timeoutMs: (ctx.args.absentSeconds + 300) * 1000 }, async (env) => {
    const { config, args } = ctx
    const table = await env.table()
    await table.start()
    for (let n = 0; n < (config.warm ?? 6); n++) {
      const s = await table.state(0)
      if (s.status !== "playing") break
      const who = table.waitedFor(s)
      if (who >= 0) await table.play(who, { state: who === 0 ? s : null })
    }
    const page = await env.board(table)
    env.say(`waiting ${args.absentSeconds} s with the other seats away`)
    // Nobody but the viewer's page reads the table from here on
    await sleep(args.absentSeconds * 1000)
    const s = await table.state(0)
    const drawn = await page.eval(boardDrawn)
    const text = await page.eval(pageText)
    writeFileSync(join(ctx.out, `absent-${seats}p.jpg`), await page.screenshot())
    env.result.files.push(`absent-${seats}p.jpg`)
    env.result.data = {
      waitedSeconds: args.absentSeconds,
      present: s.present?.length ?? null,
      of: seats,
      waitingFor: table.names[table.waitedFor(s)] ?? null,
      takeovers: s.takeovers ?? [],
      text: text.slice(0, 400),
    }
    if (!drawn.canvas || !drawn.scene) env.fail("the board is no longer drawn after the others were away")
    if ((s.present?.length ?? 0) > 1) env.warn(`${s.present.length} seats are still marked present after ${args.absentSeconds} s (the platform's window is 75 s): the others were not away, or the window changed`)

    // The platform offers to play for a player who does not answer ("Play for them"); pressing it must move the table on
    const offered = await page.eval(findButton, "Play for them")
    env.result.data.takeover = { offered: !!offered, played: null }
    if (!offered) {
      env.warn(`the page did not offer to play for the player the table waits for (${table.names[table.waitedFor(s)] ?? "nobody"}) after ${args.absentSeconds} s: the game has no takeover, or its delay is longer`)
    } else {
      await page.eval(clickButton, "Play for them")
      const moved = await waitFor(async () => ((await table.state(0)).version !== s.version ? true : null), { timeoutMs: 15_000, everyMs: 400 })
      env.result.data.takeover.played = !!moved
      if (!moved) env.fail("\"Play for them\" was pressed and the table did not move in 15 s")
    }
  })
}
