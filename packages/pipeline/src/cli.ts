// The command line of `pnpm add-game "<name>"`.
import { parseArgs } from "node:util"
import type { Options } from "./pipeline.ts"
import { STEPS } from "./steps.ts"

export const USAGE = `Usage: pnpm add-game "<Game Name>" [options]   take a game from its name to the platform's catalog, one step at a time
       pnpm add-game --list                         the games that are in the pipeline, and where each one stands
       pnpm add-game --check                        is this machine ready: claude's login, the skills, Composio, the guard of a step

The steps (each is a headless Claude Code call, then a gate where you validate it or type what to change): ${STEPS.map((step) => `${step.title} (/${step.skill})`).join(", then ")}.
The state of each game is saved (~/Companies/PBGO/assets/<slug>/pipeline.json): the same command comes back to where it stopped.

Options:
  --dry-run         call nothing, write nothing: print the plan, the checks and what would be made
  --yes, -y         do not ask before starting a game
  --no-linear       do not make or move the Linear issues
  --new-session     the next call starts a fresh session of the game (the context is cleared; the state stays)
  --redo <step>     take a step, and the ones after it, back to not started (${STEPS.map((step) => step.id).join(" | ")})
  --list            the games in the pipeline
  --check           check the machine (one short call, about a cent)
  --help, -h        this text

A game's name has a capital letter or a space. A slug (the-crew), no argument, or --name, --rules, --push, --no-open run the script that creates the game's folder,
its Sanity project and its Studio (pnpm add-game --help lists them).`

export type Command =
  | { kind: "help" }
  | { kind: "list" }
  | { kind: "check" }
  | { kind: "run"; options: Options }
  | { kind: "error"; message: string }

export function parseCli(argv: readonly string[]): Command {
  let parsed
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        "dry-run": { type: "boolean" },
        yes: { type: "boolean", short: "y" },
        "no-linear": { type: "boolean" },
        "new-session": { type: "boolean" },
        redo: { type: "string" },
        list: { type: "boolean" },
        check: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const option = /Unknown option '([^']+)'/.exec(message)?.[1]
    return { kind: "error", message: option ? `Unknown option ${option}: it belongs to \`pnpm add-game <slug>\`, which creates the game's folder` : message.split("\n")[0] ?? message }
  }
  const { values, positionals } = parsed
  if (values.help) return { kind: "help" }
  if (values.list) return { kind: "list" }
  if (values.check) return { kind: "check" }
  const name = positionals.join(" ").trim()
  if (!name) return { kind: "error", message: 'Give the name of the game: pnpm add-game "Love Letter"' }
  const redo = values.redo ?? null
  if (redo !== null && !STEPS.some((step) => step.id === redo)) return { kind: "error", message: `--redo takes a step: ${STEPS.map((step) => step.id).join(", ")}` }
  return { kind: "run", options: { name, dryRun: values["dry-run"] === true, yes: values.yes === true, noLinear: values["no-linear"] === true, newSession: values["new-session"] === true, redo } }
}
