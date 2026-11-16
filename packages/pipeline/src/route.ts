// `pnpm add-game` has two behaviours behind one name. A game's name (a capital letter or a space: it is not a slug) starts the pipeline; a slug, no argument or the
// flags of the script that makes the game's folder (`--name`, `--rules`, `--push`, `--no-open`) run that script as it always did. scripts/add-game.sh asks
// `bin/route.ts`, which prints the answer: the decision is this pure function, tested, and not a pattern of Bash.
import { SLUG_PATTERN } from "@pbgo/games/slug"

/** The flags that only the pipeline knows. */
const PIPELINE_FLAGS = new Set(["--check", "--list", "--redo", "--new-session", "--no-linear"])
/** The flags that only the script that makes the game's folder knows. */
const SCRIPT_FLAGS = new Set(["--name", "--rules", "--push", "--no-open"])
/** The flags that take a value as the next word. */
const WITH_VALUE = new Set(["--name", "--rules", "--redo"])

export type Route = "pipeline" | "plumbing"

export function routeArgs(argv: readonly string[]): Route {
  const words: string[] = []
  let pipeline = false
  let script = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? ""
    if (arg === "--") {
      words.push(...argv.slice(index + 1))
      break
    }
    if (arg.startsWith("--")) {
      const flag = arg.split("=")[0] ?? arg
      if (PIPELINE_FLAGS.has(flag)) pipeline = true
      if (SCRIPT_FLAGS.has(flag)) script = true
      if (WITH_VALUE.has(flag) && !arg.includes("=")) index += 1
      continue
    }
    if (arg.startsWith("-")) continue
    words.push(arg)
  }
  if (pipeline) return "pipeline"
  if (script) return "plumbing"
  // a slug is one word: two words are a name typed without quotes
  if (words.length > 1) return "pipeline"
  const first = words[0]
  return first !== undefined && !SLUG_PATTERN.test(first) ? "pipeline" : "plumbing"
}
