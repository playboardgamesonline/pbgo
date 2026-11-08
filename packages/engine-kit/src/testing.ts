import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { isSharedErrorCode } from "./errors"

// For the tests of a game, never for its engine: this file reads the disk, and the app never imports it (`@pbgo/engine-kit/testing`).

/** The sources of an engine that can throw: its `.ts` and `.tsx` files, its tests and `node_modules` left out. */
function sourcesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === "node_modules") return []
    if (statSync(path).isDirectory()) return sourcesOf(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const asPath = (dir: string | URL) => (typeof dir === "string" ? dir : fileURLToPath(dir))

/** What an `EngineError` call looks like: `new EngineError("CODE"` has a literal code, any other `new EngineError(` has one the check cannot read. */
const CALL = /new\s+EngineError\(\s*(?:(["'`])([A-Za-z0-9_]+)\1)?/g

/**
 * The codes an engine throws, read from its sources: each code with the files that throw it (relative to `dir`), and the calls whose code is not a string
 * literal (`file:line`), which a reader of the sources cannot tell.
 */
export function thrownErrorCodes(dir: string | URL): { codes: Map<string, string[]>; dynamic: string[] } {
  const root = asPath(dir)
  const codes = new Map<string, string[]>()
  const dynamic: string[] = []
  for (const file of sourcesOf(root)) {
    const text = readFileSync(file, "utf8")
    const name = relative(root, file)
    for (const call of text.matchAll(CALL)) {
      const code = call[2]
      if (code === undefined) {
        dynamic.push(`${name}:${text.slice(0, call.index).split("\n").length}`)
        continue
      }
      const files = codes.get(code) ?? []
      if (!files.includes(name)) files.push(name)
      codes.set(code, files)
    }
  }
  return { codes, dynamic }
}

/**
 * What is wrong with the error codes of a game, in sentences; an empty list when they are right. `engineDir` is the sources of its engine, `own` the `ERROR_CODES` of its binding:
 * every code the engine throws is one of the shared codes (`SHARED_ERROR_CODES`) or one of the game's own, and the list holds only the game's own, once each.
 */
export function errorVocabularyProblems({ engineDir, own }: { engineDir: string | URL; own: readonly string[] }): string[] {
  const { codes, dynamic } = thrownErrorCodes(engineDir)
  const problems: string[] = []
  for (const where of dynamic) problems.push(`${where}: the code of this EngineError is not a string literal, so the codes the engine throws cannot be checked`)
  for (const [code, files] of codes) {
    if (!isSharedErrorCode(code) && !own.includes(code)) problems.push(`${code} is thrown in ${files.join(", ")}, and is neither a shared code nor in ERROR_CODES`)
  }
  const seen = new Set<string>()
  for (const code of own) {
    if (isSharedErrorCode(code)) problems.push(`${code} is a shared code, which the platform words: take it out of ERROR_CODES`)
    else if (seen.has(code)) problems.push(`${code} is in ERROR_CODES more than once`)
    seen.add(code)
  }
  return problems
}
