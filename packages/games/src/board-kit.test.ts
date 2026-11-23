import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { codeFiles, kitExports, kitFiles, readBoard, readBoards, readModule, reachedBy, resolveModule, sharedByAll } from "./board-kit.ts"

// The analysis reads source with the TypeScript parser and follows imports as a bundler does, so these write a small repository of their own and ask it what a board reaches: the kit has an index and a few
// files, two games have a board, one has none.
let repo = ""
const write = (path: string, text: string) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true })
  writeFileSync(join(repo, path), text)
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "board-kit-"))
  write(
    "packages/table/src/index.ts",
    ['export { A } from "./a"', 'export { B, type T } from "./b"', 'export { C } from "./c"', 'export type { OnlyType } from "./types"', 'export { D as Renamed } from "./d"'].join("\n"),
  )
  write("packages/table/src/a.ts", 'import { helper } from "./lib/helper"\nimport type { T } from "./b"\nexport const A: T = helper\n')
  write("packages/table/src/lib/helper.ts", "export const helper = 1\n")
  write("packages/table/src/b.ts", "export const B = 2\nexport type T = number\n")
  write("packages/table/src/c.ts", "export const C = 3\n")
  write("packages/table/src/d.ts", "export const D = 4\n")
  write("packages/table/src/types.ts", "export type OnlyType = 1\n")
  write("packages/table/src/c.test.ts", 'import { C } from "./c"\nvoid C\n')
  write(
    "games/demo/src/components/board/scene.tsx",
    [
      'import { A, Renamed } from "@pbgo/table"',
      'import type { T } from "@pbgo/table"',
      'import { useFrame } from "@react-three/fiber"',
      'import { place } from "../../lib/place"',
      "// import { C } from \"@pbgo/table\" is only a word in a comment",
      "export const Scene = ({ t }: { t: T }) => {",
      "  useFrame(() => void [A, Renamed, place, t])",
      "  return (",
      "    <group>",
      "      <mesh>",
      "        <planeGeometry />",
      "      </mesh>",
      "      <div />",
      "    </group>",
      "  )",
      "}",
    ].join("\n"),
  )
  write("games/demo/src/lib/place.ts", "export const place = 1\n")
  write("games/other/src/components/board/scene.tsx", 'import { B, C } from "@pbgo/table"\nexport const Scene = () => <group>{[B, C]}</group>\n')
  write("games/none/src/index.ts", "export {}\n")
  write("template/src/components/board/scene.tsx", 'import { A } from "@pbgo/table"\nexport const Scene = () => <group>{A}</group>\n')
})

afterAll(() => rmSync(repo, { recursive: true, force: true }))

describe("readModule", () => {
  it("lists what a module loads when it runs: a type that is imported is erased and no word of a comment is an import", () => {
    const reading = readModule("x.tsx", ['import a, { b, type c as d } from "./one"', 'import type { e } from "./two"', 'import * as f from "./three"', 'import "./four"', "// import g from \"./five\"", 'const lazy = () => import("./six")'].join("\n"))
    expect(reading.imports).toEqual([
      { from: "./one", names: ["default", "b"] },
      { from: "./three", names: ["*"] },
      { from: "./four", names: [] },
      { from: "./six", names: ["*"] },
    ])
  })

  it("lists the names a module gives out from another, under the name they are given out by, and what is only a type", () => {
    const reading = readModule("index.ts", ['export { a, b as c, type d } from "./one"', 'export type { e } from "./two"', 'export * from "./three"', "export const f = 1"].join("\n"))
    expect(reading.exports).toEqual([
      { from: "./one", names: ["a", "c"] },
      { from: "./three", names: ["*"] },
    ])
  })

  it("lists the elements of the scene it writes and none of the page's", () => {
    const reading = readModule("scene.tsx", "export const x = () => <group><mesh /><planeGeometry /><div><svg><path /></svg></div><Card /></group>")
    expect(reading.elements).toEqual(["group", "mesh", "planeGeometry"])
  })
})

describe("resolveModule", () => {
  it("finds a file by its ending or as the index of a folder, and nothing for a package", () => {
    expect(resolveModule(join(repo, "packages/table/src/index.ts"), "./a")).toBe(join(repo, "packages/table/src/a.ts"))
    expect(resolveModule(join(repo, "packages/table/src/a.ts"), "./lib/helper")).toBe(join(repo, "packages/table/src/lib/helper.ts"))
    expect(resolveModule(join(repo, "games/demo/src/components/board/scene.tsx"), "../../lib/place")).toBe(join(repo, "games/demo/src/lib/place.ts"))
    expect(resolveModule(join(repo, "packages/table/src/a.ts"), "./nothing")).toBeNull()
    expect(resolveModule(join(repo, "packages/table/src/a.ts"), "three")).toBeNull()
  })
})

describe("codeFiles and kitFiles", () => {
  it("list the files of code and leave the tests out", () => {
    expect(kitFiles(repo)).toEqual(["packages/table/src/a.ts", "packages/table/src/b.ts", "packages/table/src/c.ts", "packages/table/src/d.ts", "packages/table/src/index.ts", "packages/table/src/lib/helper.ts", "packages/table/src/types.ts"])
    expect(codeFiles(join(repo, "games/none"))).toHaveLength(1)
  })
})

describe("kitExports", () => {
  it("maps each name the kit gives out to the file that holds it, by the name it is given out under", () => {
    const names = kitExports(repo)
    expect(names.get("A")).toBe(join(repo, "packages/table/src/a.ts"))
    expect(names.get("Renamed")).toBe(join(repo, "packages/table/src/d.ts"))
    expect(names.has("D")).toBe(false)
    expect(names.has("T")).toBe(false)
    expect(names.has("OnlyType")).toBe(false)
  })

  it("refuses an `export *`, which would hide which file an import reaches", () => {
    const other = mkdtempSync(join(tmpdir(), "board-kit-star-"))
    try {
      mkdirSync(join(other, "packages/table/src"), { recursive: true })
      writeFileSync(join(other, "packages/table/src/index.ts"), 'export * from "./a"\n')
      writeFileSync(join(other, "packages/table/src/a.ts"), "export const A = 1\n")
      expect(() => kitExports(other)).toThrow(/export \* from "\.\/a"/)
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })
})

describe("readBoard", () => {
  it("reads what a board takes from the kit, the files of the kit that reaches, and the three.js it writes itself", () => {
    const board = readBoard(repo, "demo")
    expect(board).toEqual({
      slug: "demo",
      files: ["games/demo/src/components/board/scene.tsx"],
      names: ["A", "Renamed"],
      // a.ts loads lib/helper.ts; it imports a type from b.ts, which is erased, so b.ts is not reached; c.ts is only named in a comment
      kit: ["packages/table/src/a.ts", "packages/table/src/d.ts", "packages/table/src/lib/helper.ts"],
      elements: ["mesh", "planeGeometry"],
      hooks: ["useFrame"],
    })
  })

  it("finds no board in a game that has none, and reads the template like a game", () => {
    expect(readBoard(repo, "none")).toBeNull()
    expect(readBoard(repo, "template")?.kit).toEqual(["packages/table/src/a.ts", "packages/table/src/lib/helper.ts"])
  })

  it("reads several at once and leaves the games with no board out", () => {
    expect(readBoards(repo, ["demo", "none", "other"]).map((board) => board.slug)).toEqual(["demo", "other"])
  })
})

describe("reachedBy and sharedByAll", () => {
  const boards = () => readBoards(repo, ["demo", "other", "template"])

  it("say which boards an edit of a file of the kit changes", () => {
    expect(reachedBy(boards(), "packages/table/src/a.ts")).toEqual(["demo", "template"])
    expect(reachedBy(boards(), "packages/table/src/c.ts")).toEqual(["other"])
    expect(reachedBy(boards(), "packages/table/src/types.ts")).toEqual([])
  })

  it("list the files that every board reaches, and none for no board", () => {
    expect(sharedByAll(readBoards(repo, ["demo", "template"]))).toEqual(["packages/table/src/a.ts", "packages/table/src/lib/helper.ts"])
    expect(sharedByAll(boards())).toEqual([])
    expect(sharedByAll([])).toEqual([])
  })
})
