// The cases that the engine's debug commands can rig (`GAME.debug`), each recorded as frames: a move plays out in under a second, so a screenshot says nothing about it, but nine frames from the first change of the page do. The game's config
// lists its own cases (a special card, a bust, a save); every game gets two: `turn`, one turn played by the engine, and `over`, the game played to its end (the end screen). One table serves all of them, in the order they are listed.
import { runCheck, settle } from "../run.mjs"
import { sleep } from "../util.mjs"

/** A case that cannot be made here, and why: a warning, not a failure */
class Skip extends Error {}

/** Records the move of one of the engine's own debug commands; a game that has none is skipped, not failed */
async function rigged(command, { table, record }, options) {
  try {
    return await record(() => table.rig(command), options)
  } catch (error) {
    if (/→ 400 INVALID_ACTION/.test(String(error?.message))) throw new Skip(`the engine has no \`${command}\` debug command (\`GAME.debug\`): the case was not recorded`)
    throw error
  }
}

/** The cases of every game. `over` goes last: nothing can be played after it */
const GENERIC = {
  turn: { run: (context) => rigged("turn", context, { seconds: 6 }) },
  over: {
    run: async (context) => {
      const recorded = await rigged("over", context, { seconds: 12 })
      const after = await context.table.state(0)
      if (after.status !== "over") throw new Error(`the engine's \`over\` command left the table "${after.status}"`)
      return recorded
    },
  },
}

/** What the last move of the table said happened (the lines of the log with the highest version), as short texts */
function lastEvents(state) {
  const log = state.log ?? []
  const latest = Math.max(0, ...log.map((line) => line.v))
  return log
    .filter((line) => line.v === latest)
    .map((line) => JSON.stringify(line.event).slice(0, 100))
    .slice(0, 8)
}

export async function scenarios(ctx, seats) {
  return runCheck(ctx, { check: "scenarios", seats, timeoutMs: 1_200_000 }, async (env) => {
    const { config, args } = ctx
    const defined = { ...(config.scenarios ?? {}) }
    for (const [name, scenario] of Object.entries(GENERIC)) if (!(name in defined)) defined[name] = scenario
    // The game's own cases in the order of its config, then the generic ones, `over` last
    const order = [...Object.keys(config.scenarios ?? {}), ...Object.keys(GENERIC).filter((name) => !(name in (config.scenarios ?? {})))]
    const wanted = args.scenarios ? order.filter((name) => args.scenarios.includes(name)) : order
    for (const name of args.scenarios ?? []) if (!(name in defined)) env.fail(`there is no case "${name}" (the cases are ${order.join(", ")})`)
    if (wanted.length === 0) return

    const table = await env.table()
    await table.start()
    const page = await env.board(table)
    env.result.data.cases = {}

    for (const name of wanted) {
      const scenario = typeof defined[name] === "function" ? { run: defined[name] } : defined[name]
      const sheet = `scenarios-${seats}p-${name}`
      const context = {
        table,
        page,
        seats,
        name,
        sleep,
        /** Lets the board learn of what the table is at and stand still: after a move that was rigged, before the one that is recorded */
        settle: async (options) => {
          await page.knows((await table.state(0)).version)
          return settle(page, options)
        },
        /** Records the move that `action` makes: nine frames from the first change of the page */
        record: (action, options = {}) => env.record(page, sheet, action, { ...(scenario.record ?? {}), ...options }),
      }
      try {
        const recorded = await scenario.run(context)
        const after = await table.state(0)
        env.result.data.cases[name] = { ...(recorded ?? {}), sheet: `${sheet}.png`, events: lastEvents(after) }
        if (recorded && recorded.seenAfterMs === null) env.warn(`${name}: the text of the page never changed after the move: the board did not learn of it, or the history says nothing`)
        env.say(`${name}: ${recorded?.frames ?? 0} frames → ${sheet}.png`)
      } catch (error) {
        if (error instanceof Skip) env.warn(`${name}: ${error.message}`)
        else env.fail(`${name}: ${String(error?.message ?? error).slice(0, 240)}`)
      }
    }
  })
}
