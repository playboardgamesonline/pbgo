// The board at every window the platform lets in, for one count of seats, in each situation the game's config names (by default the viewer's move): one sheet per situation, a window to a tile, and what was measured in each window: whether
// anything scrolls sideways, which boxes of the platform lie over the board, where the camera stands and whether every control that is pressable can be reached.
import { overlays, pageMetrics, readScene, scanPressables } from "../probe.mjs"
import { runCheck, settle } from "../run.mjs"
import { sleep } from "../util.mjs"

/** The situations of the board that every game has: the viewer's move */
const DEFAULT_SCENES = {
  turn: (table) => table.advance({ until: (_s, who) => who === 0, label: "the viewer's move" }),
}

export async function sizes(ctx, seats) {
  return runCheck(ctx, { check: "sizes", seats }, async (env) => {
    const { config, args } = ctx
    const scenes = Object.entries(config.scenes ?? DEFAULT_SCENES)
    const table = await env.table()
    await table.start()
    await scenes[0][1](table)
    const page = await env.board(table)
    const [reference] = args.sizes
    env.result.data.scenes = {}

    for (const [index, [name, prepare]] of scenes.entries()) {
      if (index > 0) {
        // the next situation is reached through the API while the page stays open, at the window it was last in
        await page.setViewport(...reference)
        await prepare(table)
        await page.knows((await table.state(0)).version)
        await sleep(600)
      }
      const shots = []
      const measured = {}
      for (const [width, height] of args.sizes) {
        const size = `${width}x${height}`
        await page.setViewport(width, height)
        const still = await settle(page, { minMs: 600 })
        shots.push(await page.screenshot())
        const scene = await page.eval(readScene)
        const metrics = await page.eval(pageMetrics)
        const scan = await page.eval(scanPressables)
        const pressables = scan.ok ? scan.pressables.filter((p) => p.shown) : []
        measured[size] = {
          settledMs: still.ms,
          camera: scene.ok ? scene.camera.position.map((v) => Math.round(v * 100) / 100) : null,
          overlays: (await page.eval(overlays)).slice(0, 8),
          pressables: pressables.map((p) => ({ path: p.path, world: p.world, pixel: p.pixel, reachable: p.reachable, why: p.why })),
        }
        if (!still.settled) env.warn(`${name} ${size}: the board never stood still`)
        if (metrics.scrollsSideways) env.warn(`${name} ${size}: the page scrolls sideways (${metrics.scrollWidth} px wide in a ${metrics.innerWidth} px window)`)
        for (const p of pressables.filter((item) => !item.reachable)) {
          // every control must be reachable in the first window, the laptop; in a smaller one the table may legitimately lie under the platform's boxes
          const message = `${name} ${size}: a control (${p.path}, at ${p.world?.map((v) => Math.round(v * 10) / 10).join(", ")}) cannot be pressed: ${p.why}`
          if (size === `${reference[0]}x${reference[1]}`) env.fail(message)
          else env.warn(message)
        }
      }
      env.result.data.scenes[name] = measured
      await env.sheet(`sizes-${seats}p-${name}`, shots, { columns: 3, cell: [640, 400] })
      env.say(`${name}: ${args.sizes.length} windows → sizes-${seats}p-${name}.png`)
    }
    env.result.data.windows = args.sizes.map(([w, h]) => `${w}x${h}`)
  })
}
