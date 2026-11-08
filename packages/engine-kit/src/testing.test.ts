import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { errorVocabularyProblems, thrownErrorCodes } from "./testing"

const made: string[] = []

/** An engine on disk: file name → text */
function engine(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "engine-kit-"))
  made.push(dir)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe("thrownErrorCodes", () => {
  it("reads the literal codes of the sources, with the files that throw them", () => {
    const dir = engine({
      "actions.ts": `if (!ok) throw new EngineError("INVALID_ACTION")\nif (!turn) throw new EngineError('NOT_YOUR_TURN', "wait")`,
      "rules/stay.ts": `throw new EngineError(\`CANNOT_STAY\`)`,
      "rules/hit.ts": `throw new EngineError("INVALID_ACTION")`,
    })
    const { codes, dynamic } = thrownErrorCodes(dir)
    expect([...codes.keys()].sort()).toEqual(["CANNOT_STAY", "INVALID_ACTION", "NOT_YOUR_TURN"])
    expect(codes.get("INVALID_ACTION")?.sort()).toEqual(["actions.ts", join("rules", "hit.ts")])
    expect(dynamic).toEqual([])
  })

  it("points at the calls whose code it cannot read, by file and line", () => {
    const dir = engine({ "machine.ts": `const a = 1\n\nthrow new EngineError(code)\nthrow new EngineError(\n  "INVALID_ACTION",\n)` })
    const { codes, dynamic } = thrownErrorCodes(dir)
    expect(dynamic).toEqual(["machine.ts:3"])
    expect([...codes.keys()]).toEqual(["INVALID_ACTION"])
  })

  it("leaves the tests and node_modules alone, and takes a file URL as well as a path", () => {
    const dir = engine({
      "game.ts": `throw new EngineError("GAME_OVER")`,
      "game.test.ts": `expect(() => play()).toThrow(new EngineError("MADE_UP"))`,
      "node_modules/dep/index.ts": `throw new EngineError("DEPENDENCY")`,
    })
    expect([...thrownErrorCodes(pathToFileURL(dir)).codes.keys()]).toEqual(["GAME_OVER"])
  })
})

describe("errorVocabularyProblems", () => {
  it("is silent when the engine throws shared codes and the codes it lists", () => {
    const dir = engine({ "game.ts": `throw new EngineError("NOT_YOUR_TURN")\nthrow new EngineError("INVALID_BID")` })
    expect(errorVocabularyProblems({ engineDir: dir, own: ["INVALID_BID"] })).toEqual([])
  })

  it("names a code that is neither shared nor listed, and where it is thrown", () => {
    const dir = engine({ "game.ts": `throw new EngineError("INVALID_BDI")` })
    expect(errorVocabularyProblems({ engineDir: dir, own: ["INVALID_BID"] })).toEqual(["INVALID_BDI is thrown in game.ts, and is neither a shared code nor in ERROR_CODES"])
  })

  it("asks for a code that is a string literal", () => {
    const dir = engine({ "game.ts": `throw new EngineError(code)` })
    expect(errorVocabularyProblems({ engineDir: dir, own: [] })).toEqual(["game.ts:1: the code of this EngineError is not a string literal, so the codes the engine throws cannot be checked"])
  })

  it("keeps the shared codes out of the list: the platform words them", () => {
    const dir = engine({ "game.ts": `throw new EngineError("NOT_YOUR_TURN")` })
    expect(errorVocabularyProblems({ engineDir: dir, own: ["NOT_YOUR_TURN"] })).toEqual(["NOT_YOUR_TURN is a shared code, which the platform words: take it out of ERROR_CODES"])
  })

  it("lists a code of the game once", () => {
    const dir = engine({ "game.ts": `throw new EngineError("INVALID_BID")` })
    expect(errorVocabularyProblems({ engineDir: dir, own: ["INVALID_BID", "INVALID_BID"] })).toEqual(["INVALID_BID is in ERROR_CODES more than once"])
  })

  it("lets a listed code stand when a route of the game throws it instead of the engine", () => {
    const dir = engine({ "game.ts": `throw new EngineError("NOT_YOUR_TURN")` })
    expect(errorVocabularyProblems({ engineDir: dir, own: ["NOT_READY"] })).toEqual([])
  })
})
