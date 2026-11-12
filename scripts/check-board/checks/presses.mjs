// Plays the viewer's side of a table with the mouse, the way a person does: whatever the game's config says is next (`presses.plan`), the board has to offer a control for (`presses.find`), at a pixel that a pointer reaches, and a press
// of it has to move the table on (its version changes). The other seats play through the API. A press that does nothing is a control under the banner, the HUD or another card; the report says what is on top of it.
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { scanPressables } from "../probe.mjs"
import { runCheck, skipped } from "../run.mjs"
import { sleep, waitFor } from "../util.mjs"

export async function presses(ctx, seats) {
  const config = ctx.config.presses
  if (!config?.plan || !config?.find) return skipped("presses", seats, `no \`presses\` (a \`plan\` and a \`find\`) in ${ctx.configName}: what the viewer presses is the game's to say, so the controls were not pressed`)
  return runCheck(ctx, { check: "presses", seats, timeoutMs: 900_000 }, async (env) => {
    const table = await env.table()
    await table.start()
    const page = await env.board(table)
    const me = table.ids[0]
    const exercised = new Set()
    const pressed = []
    const max = config.max ?? 60
    // The time the check may take to come to everything in `expect`: a situation that needs many rounds (the viewer deals once in a round of the table) is given this long, then reported as not covered. The others move quickly through the API
    const budget = (config.budgetSeconds ?? 150) * 1000
    const began = Date.now()
    const between = config.bot ?? table.bot
    env.result.data.pressed = pressed

    /** A picture of the page at the moment a press cannot be made or did nothing */
    const evidence = async (name) => {
      const path = `presses-${seats}p-${name}.jpg`
      writeFileSync(join(ctx.out, path), await page.screenshot())
      env.result.files.push(path)
      return path
    }

    for (let step = 0; pressed.length < max; step++) {
      if (config.expect && config.expect.every((label) => exercised.has(label))) break
      if (Date.now() - began > budget) break
      const s = await table.state(0)
      if (s.status === "over") break
      const who = table.waitedFor(s)
      if (who < 0) {
        await sleep(300)
        continue
      }
      // the others, and the viewer when there is nothing to press for them, play through the API
      const plan = who === 0 ? await config.plan({ state: s, me, table, exercised }) : null
      if (!plan) {
        await table.play(who, { bot: between, state: who === 0 ? s : null })
        continue
      }
      if (plan.prepare) await plan.prepare(table)
      const latest = await table.state(0)
      // the board shows the table as the page has been told it: wait until it has been told this one
      if (!(await page.knows(latest.version))) throw new Error(`the page was never told version ${latest.version} of the table (it knows ${page.seen.version}): it does not follow the table`)
      // A scan or a `find` that throws is a bug to be told, not a control that has not appeared yet
      let broke = null
      const found = await waitFor(
        async () => {
          try {
            const scan = await page.eval(scanPressables)
            if (!scan.ok) return null
            const shown = scan.pressables.filter((p) => p.shown)
            const pressable = await config.find({ label: plan.label, pressables: shown, state: latest, me })
            return pressable ? { pressable, shown } : null
          } catch (error) {
            broke = error
            return null
          }
        },
        { timeoutMs: 15_000, everyMs: 400 },
      )
      if (!found) {
        const scan = await page.eval(scanPressables).catch(() => ({ ok: false }))
        const offered = scan.ok ? scan.pressables.filter((p) => p.shown).map((p) => `${p.path} at ${p.world?.map((v) => Math.round(v * 10) / 10).join(",")}`) : []
        await evidence(`${plan.label}-missing`)
        throw new Error(`"${plan.label}": the board offered no control for it within 15 s (it offers ${offered.length}: ${offered.join("; ") || "none"})${broke ? `; the scan or \`find\` threw: ${broke.message}` : ""}`)
      }
      const { pressable } = found
      if (!pressable.reachable) {
        await evidence(`${plan.label}-covered`)
        throw new Error(`"${plan.label}" cannot be pressed: ${pressable.why} (${pressable.path} at ${pressable.world?.map((v) => Math.round(v * 10) / 10).join(", ")}, in the middle of the window at ${pressable.center?.join(", ")})`)
      }
      const before = latest.version
      const pressedAt = Date.now()
      let moved = null
      for (let attempt = 0; attempt < 2 && !moved; attempt++) {
        await page.click(...pressable.pixel)
        moved = await waitFor(async () => ((await table.state(0)).version !== before ? true : null), { timeoutMs: 6000, everyMs: 300 })
      }
      if (!moved) {
        await evidence(`${plan.label}-nothing`)
        throw new Error(`"${plan.label}": two presses at ${pressable.pixel.map(Math.round).join(", ")} (${pressable.path}) changed nothing in 12 s: the version of the table stayed ${before}`)
      }
      exercised.add(plan.label)
      pressed.push({ label: plan.label, pixel: pressable.pixel.map(Math.round), world: pressable.world, ms: Date.now() - pressedAt })
      env.say(`pressed "${plan.label}" at ${pressable.pixel.map(Math.round).join(", ")}`)
    }
    env.result.data.exercised = [...exercised]
    const missing = (config.expect ?? []).filter((label) => !exercised.has(label))
    if (missing.length) env.warn(`not pressed in ${pressed.length} presses and ${Math.round((Date.now() - began) / 1000)} s: ${missing.join(", ")} (the table did not come to it: look at the plan of the config, or give \`presses.budgetSeconds\` more)`)
  })
}
