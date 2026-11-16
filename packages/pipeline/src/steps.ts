// The steps of the pipeline, in order. A step is a skill of the repo (`.claude/skills/<skill>/SKILL.md`) that a headless call runs as a slash command, the gates
// the owner answers after it, and the policy of what it may do. The first version has two steps; the later ones of "A game from A to Z"
// (`.claude/skills/README.md`) are added here, each with its skill.
import { join } from "node:path"
import type { GateKind } from "./gate.ts"
import { BASH, mkdirRule, PLATFORM_SANITY, type Policy } from "./policy.ts"
import { SCOUT_FILE } from "./state.ts"

/** The game as the pipeline knows it: the name, the slug, its folder of working files and its scout file. */
export type Game = { name: string; slug: string; dir: string; scoutFile: string }

export function gameOf(assets: string, name: string, slug: string): Game {
  return gameAt(join(assets, slug), name, slug)
}

/** A game whose folder is where it was found (the folder of its state), whatever it is called. */
export function gameAt(dir: string, name: string, slug: string): Game {
  return { name, slug, dir, scoutFile: join(dir, SCOUT_FILE) }
}

/** What a call knows that the step does not: the name of Composio's server in a tool name, and the documents the gate showed (for the call that publishes them). */
export type PolicyExtras = { composioServer: string; publishIds: readonly string[] }

export type StepDefinition = {
  id: string
  /** how the step is named in the terminal and in Linear ("scout", "catalog entry") */
  title: string
  skill: string
  /** the lane label of its Linear issue */
  lane: "Game lane" | "Platform lane"
  /** the skill's file, relative to the repo: the command refuses to start without it */
  skillFile: string
  /** the gates after the step, in order: the first says the work is right, the next ones are the words that act (`publish`) */
  gates: GateKind[]
  /** the first message of the step: the skill, as a slash command */
  prompt: (game: Game) => string
  /** whether the step uses Composio (its two lookup tools are allowed by name, the executor only through the hook) */
  composio: boolean
  policy: (game: Game, repoRoot: string, extras: PolicyExtras) => Policy
}

export const SCOUT: StepDefinition = {
  id: "scout",
  title: "scout",
  skill: "game-scout",
  lane: "Game lane",
  skillFile: ".claude/skills/game-scout/SKILL.md",
  gates: ["validate"],
  // `--out` puts the file where the command keeps the game's files, whatever the slug the scout settles on: moving the folder is the command's job
  prompt: (game) => `/game-scout ${game.name} --out ${game.scoutFile}`,
  composio: false,
  // the one file it writes is the scout file (and reads it back to correct it): never the policy, the state or the log that sit in the same folder
  policy: (game, repoRoot) => ({
    repoRoot,
    workDir: game.dir,
    writeFiles: [game.scoutFile],
    readFiles: [game.scoutFile],
    bash: [BASH.checkScout, BASH.catalogList, BASH.checkGame, BASH.bggLookup, BASH.date, BASH.nodeOneLiner, mkdirRule(game.dir)],
    composio: null,
  }),
}

export const CATALOG_ENTRY: StepDefinition = {
  id: "catalog-entry",
  title: "catalog entry",
  skill: "platform-catalog-entry",
  lane: "Platform lane",
  skillFile: ".claude/skills/platform-catalog-entry/SKILL.md",
  // the first gate says the drafts are right; the second is the word that makes them public
  gates: ["validate", "publish"],
  prompt: (game) => `/platform-catalog-entry ${game.scoutFile}`,
  composio: true,
  // it writes no file: its writes are Sanity's, through Composio, and only drafts before the word publish
  policy: (game, repoRoot, extras) => ({
    repoRoot,
    workDir: game.dir,
    writeFiles: [],
    readFiles: [game.scoutFile],
    bash: [BASH.checkScout, BASH.catalogList, BASH.nodeOneLiner],
    composio: {
      server: extras.composioServer,
      slugs: ["SANITY_QUERY_DOCUMENTS", "SANITY_MUTATE_DOCUMENTS"],
      sanity: { ...PLATFORM_SANITY, gameSlug: game.slug, publishIds: [...extras.publishIds] },
      linear: null,
    },
  }),
}

export const STEPS: readonly StepDefinition[] = [SCOUT, CATALOG_ENTRY]

/** The tools a call is allowed by name: the read-only ones. Everything that writes or runs something is allowed by the hook alone, so that a hook that does not load refuses it. */
export function allowedTools(step: StepDefinition, composioPrefix: string): string[] {
  const tools = ["ToolSearch", "WebSearch", "WebFetch"]
  if (step.composio) tools.push(`${composioPrefix}COMPOSIO_SEARCH_TOOLS`, `${composioPrefix}COMPOSIO_GET_TOOL_SCHEMAS`)
  return tools
}

/** The first step that is not validated, `undefined` when the game is done. */
export function firstOpen(isValidated: (id: string) => boolean): StepDefinition | undefined {
  return STEPS.find((step) => !isValidated(step.id))
}
