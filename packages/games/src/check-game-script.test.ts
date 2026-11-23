import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { BOARD_DIR } from "./board-kit.ts"
import { GAMES } from "./registry"

// `scripts/check-game.mjs` reads files only and is run by Node itself: this runs it as `pnpm check:game` does, on the template (always there, and a game that has not got far: its engine is the demo, its
// flags are off), to check the two kinds of gate. `--stage` is every check up to a stage; `--only` is one stage alone, for a step that is done out of order (`/add-game` gates the Studio's forms by it).
const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const check = (...args: string[]) => {
  const run = spawnSync(process.execPath, ["scripts/check-game.mjs", "template", ...args], { cwd: REPO, encoding: "utf8", timeout: 30_000 })
  return { status: run.status, out: run.stdout, err: run.stderr }
}

describe("pnpm check:game --only", () => {
  it("is a gate for one stage: exit 0 when the checks of that stage pass, and the other stages are said not to count", () => {
    const run = check("--only", "scaffold")
    expect(run.status).toBe(0)
    expect(run.out).toContain("scaffold\n")
    expect(run.out).toMatch(/^engine \(not this gate\)$/m)
    expect(run.out).toMatch(/^live \(not this gate\)$/m)
    expect(run.out).toContain("The stage scaffold passes.")
  })

  it("exits 1 when a check of that stage fails, and says how many", () => {
    const run = check("--only", "engine")
    expect(run.status).toBe(1)
    expect(run.out).toMatch(/Not ready: \d+ to fix in the stage engine\./)
    expect(run.out).toContain("still the template's demo engine")
  })

  it("does not count the stages before it, which is what --stage does: the content of a game whose engine is not written passes its own gate", () => {
    expect(check("--only", "content").status).toBe(0)
    expect(check("--stage", "content").status).toBe(1)
    expect(check("--stage", "content").out).toContain("Not ready for after content")
  })

  it("is not a gate without a flag, and refuses both flags together and a stage that does not exist", () => {
    expect(check().status).toBe(0)
    const both = check("--stage", "engine", "--only", "engine")
    expect(both.status).toBe(2)
    expect(both.err).toContain("exclude each other")
    for (const args of [["--only", "nope"], ["--only"], ["--stage", "nope"]]) {
      const run = check(...args)
      expect(run.status, args.join(" ")).toBe(2)
      expect(run.err, args.join(" ")).toContain("The stages are scaffold, engine, binding, board, content, live")
    }
  })

  it("finds the slug whichever way the flags come", () => {
    const run = spawnSync(process.execPath, ["scripts/check-game.mjs", "--only", "scaffold", "template"], { cwd: REPO, encoding: "utf8", timeout: 30_000 })
    expect(run.status).toBe(0)
    expect(run.stdout).toContain("template has got as far as")
  })
})

describe("pnpm check:game --online", () => {
  // The Sanity project of a game is asked on the public API of its production dataset; a stand-in for `fetch` answers with the status of SANITY_STATUS (or fails, for `offline`), so nothing leaves the machine.
  const STUB = `globalThis.fetch = async () => { if (process.env.SANITY_STATUS === "offline") throw new Error("offline"); return new Response("{}", { status: Number(process.env.SANITY_STATUS) }) }`
  const online = (slug: string, status: string, ...args: string[]) => {
    const run = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(STUB)}`, "scripts/check-game.mjs", slug, ...args], { cwd: REPO, encoding: "utf8", timeout: 30_000, env: { ...process.env, SANITY_STATUS: status } })
    return { status: run.status, out: run.stdout }
  }

  it("says, without the flag, that an id of the right shape is all it read", () => {
    const run = check("--only", "scaffold")
    expect(run.out).toContain("the shape of the id only: `--online` asks Sanity")
  })

  it("passes a project whose production dataset answers, public (200) or private (401, which asks for a token and still says the project is there)", () => {
    for (const status of ["200", "401"]) {
      const run = online("flip-7", status, "--only", "scaffold", "--online")
      expect(run.status, status).toBe(0)
      expect(run.out, status).toContain("its production dataset answers")
    }
  })

  it("fails the scaffold stage on a project that is not found, and says how to make a new one", () => {
    for (const gate of [["--only", "scaffold"], ["--stage", "scaffold"]]) {
      const run = online("flip-7", "404", ...gate, "--online")
      expect(run.status, gate.join(" ")).toBe(1)
      expect(run.out, gate.join(" ")).toContain("Sanity project ky3exlhe is not found")
      expect(run.out, gate.join(" ")).toContain("`pnpm go-live flip-7` says which under the Sanity login, and `--new-project` makes a new one")
    }
  })

  it("only warns when Sanity does not answer, or answers with a server error: the id is judged by its shape then", () => {
    for (const status of ["offline", "500", "429"]) {
      const run = online("flip-7", status, "--only", "scaffold", "--online")
      expect(run.status, status).toBe(0)
      expect(run.out, status).toContain("Sanity did not answer, so only the shape of the id is checked")
    }
  })

  it("never asks about the template, whose id is a stand-in", () => {
    const run = online("template", "404", "--only", "scaffold", "--online")
    expect(run.status).toBe(0)
    expect(run.out).toContain("the shape of the id only")
  })
})

describe("pnpm check:game for a game that is not in the repo yet", () => {
  const run = (assets: string, slug: string) => spawnSync(process.execPath, ["scripts/check-game.mjs", slug], { cwd: REPO, encoding: "utf8", timeout: 30_000, env: { ...process.env, PBGO_ASSETS_DIR: assets } })

  it("says where the game is in the flow, in its own folder or in the folder of its line, and how to start it when it is in neither", () => {
    const assets = mkdtempSync(join(tmpdir(), "check-game-flow-"))
    try {
      mkdirSync(join(assets, "the-line", "zzz-game-in-a-line"), { recursive: true })
      writeFileSync(join(assets, "the-line", "zzz-game-in-a-line", "pipeline.json"), JSON.stringify({ name: "Zzz Game In A Line", steps: { scout: { status: "gate" } } }))
      mkdirSync(join(assets, "zzz-flat-game"))
      writeFileSync(join(assets, "zzz-flat-game", "pipeline.json"), JSON.stringify({ name: "Zzz Flat Game", steps: { scout: { status: "validated" } } }))
      const nested = run(assets, "zzz-game-in-a-line")
      expect(nested.status).toBe(2)
      expect(nested.stderr).toContain('It is in the flow (scout gate): `/add-game "Zzz Game In A Line"` goes on.')
      expect(run(assets, "zzz-flat-game").stderr).toContain("It is in the flow (scout validated)")
      const nowhere = run(assets, "zzz-nowhere")
      expect(nowhere.status).toBe(2)
      expect(nowhere.stderr).toContain('`/add-game "<Game Name>"` starts one')
    } finally {
      rmSync(assets, { recursive: true, force: true })
    }
  })
})

describe("pnpm check:game on the games of the repository", () => {
  // The script is not one of the gates of the repository, so these are what keep a game from going back: each game that has a board must pass the stage of its board, and a game that is live must pass every stage.
  const game = (slug: string, ...args: string[]) => {
    const run = spawnSync(process.execPath, ["scripts/check-game.mjs", slug, ...args], { cwd: REPO, encoding: "utf8", timeout: 60_000 })
    return { status: run.status, out: run.stdout }
  }
  const withBoard = ["template", ...readdirSync(join(REPO, "games")).filter((slug) => existsSync(join(REPO, "games", slug, BOARD_DIR)))]

  it("says what a board is built on and that it draws nothing with three.js outside the kit", () => {
    const run = game("skyjo", "--only", "board")
    expect(run.status).toBe(0)
    expect(run.out).toMatch(/✓ kit: the board is built on @pbgo\/table: \d+ pieces, which load \d+ files of it/)
    expect(run.out).toContain("✓ own drawing: nothing is drawn with three.js outside the kit")
  })

  it("passes the board stage for every game that has a board", () => {
    expect(withBoard).toEqual(expect.arrayContaining(["template", "courtisans", "flip-7", "skyjo", "love-letter"]))
    for (const slug of withBoard) {
      const run = game(slug, "--only", "board")
      expect(run.status, `${slug}: ${run.out}`).toBe(0)
    }
  }, 60_000)

  it("passes every stage for every game that is live", () => {
    for (const { slug } of GAMES.filter((entry) => entry.live)) {
      const run = game(slug, "--stage", "live")
      expect(run.status, `${slug}: ${run.out}`).toBe(0)
    }
  }, 60_000)

  it("reads a score that is secret by design as one that says so, and a game that carries none or says nothing as behind", () => {
    // Courtisans keeps its points secret until the end and says so where it builds its view; Flip 7 carries `standings`
    expect(game("courtisans", "--only", "engine").out).not.toContain("no `standings` in the view")
    expect(game("flip-7", "--only", "engine").out).not.toContain("no `standings` in the view")
    expect(game("template", "--only", "engine").out).toContain("no `step` in the definition")
  })
})

describe("pnpm check:game on a board of a repository of its own", () => {
  // The script reads the repository `PBGO_REPO_DIR` names, so the two ways a board can be judged that no board of this repository takes today are run on boards written here: one that draws with three.js itself, which is
  // a warning and no failure, and one that does not take the `Table` of the kit, which fails the stage.
  let repo = ""
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true })
    writeFileSync(join(repo, path), text)
  }
  const board = (slug: string) => {
    const run = spawnSync(process.execPath, ["scripts/check-game.mjs", slug, "--only", "board"], { cwd: REPO, encoding: "utf8", timeout: 60_000, env: { ...process.env, PBGO_REPO_DIR: repo } })
    return { status: run.status, out: run.stdout }
  }

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "check-game-board-"))
    write("packages/games/src/registry.ts", ["export const GAMES = [", "  {", '    slug: "raw",', '    sanityProjectId: "abc12345",', "    live: false,", "    indexable: false,", "  },", "  {", '    slug: "nokit",', '    sanityProjectId: "abc12345",', "    live: false,", "    indexable: false,", "  },", "]", ""].join("\n"))
    write("packages/table/src/index.ts", 'export { Table } from "./table"\nexport { PlayerSeat } from "./seat"\n')
    write("packages/table/src/table.tsx", "export const Table = () => null\n")
    write("packages/table/src/seat.tsx", "export const PlayerSeat = () => null\n")
    write(
      "games/raw/src/components/board/scene.tsx",
      ['import { PlayerSeat, Table } from "@pbgo/table"', 'import { useFrame } from "@react-three/fiber"', "export const Scene = () => {", "  useFrame(() => {})", "  return (", "    <Table>", "      <mesh>", "        <planeGeometry />", "      </mesh>", "      <PlayerSeat />", "    </Table>", "  )", "}", ""].join("\n"),
    )
    write("games/nokit/src/components/board/scene.tsx", 'import { PlayerSeat } from "@pbgo/table"\nexport const Scene = () => <PlayerSeat />\n')
  })
  afterAll(() => rmSync(repo, { recursive: true, force: true }))

  it("warns of the three.js a board draws itself and passes the stage: a warning is no failure", () => {
    const run = board("raw")
    expect(run.out).toContain("✓ kit: the board is built on @pbgo/table: 2 pieces")
    expect(run.out).toContain("• own drawing: the board draws with three.js itself (mesh, planeGeometry, useFrame)")
    expect(run.status).toBe(0)
  })

  it("fails the stage for a board that takes no `Table` from the kit, and says which piece it lacks", () => {
    const run = board("nokit")
    expect(run.out).toContain("✗ kit: the board takes no `Table` from @pbgo/table")
    expect(run.status).toBe(1)
  })
})
