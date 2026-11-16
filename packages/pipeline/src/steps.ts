// The steps of the pipeline, in order. A step is a skill of the repo (`.claude/skills/<skill>/SKILL.md`) that Claude Code runs as a slash command and the gate the owner answers after it. There are two
// kinds. A HEADLESS step is one call (`claude -p`) that works alone, bounded by a policy of what it may do (the scout, the catalog entry, the rules spec). A SESSION step is a session of Claude Code
// that the command opens in the owner's terminal, for a skill that asks questions or acts outside the repo (it downloads, uploads, publishes): the owner is in it and approves each action, the command
// waits for them to leave, then checks the result and asks for the gate. The later steps of "A game from A to Z" (`.claude/skills/README.md`) are added one by one, each with its skill.
import { join } from "node:path"
import { specPathsOf } from "@pbgo/games/rules-spec"
import type { GateKind } from "./gate.ts"
import { BASH, mkdirRule, PLATFORM_SANITY, rulesCheckRule, type Policy } from "./policy.ts"
import { PICTURES_DIR, RULES_PDF, SCOUT_FILE } from "./state.ts"

/** The game as the pipeline knows it: the name, the slug, its folder of working files, its scout file, the rulebook next to it and the folder of its pictures for the platform. */
export type Game = { name: string; slug: string; dir: string; scoutFile: string; rulesPdf: string; picturesDir: string }

export function gameOf(assets: string, name: string, slug: string): Game {
  return gameAt(join(assets, slug), name, slug)
}

/** A game whose folder is where it was found (the folder of its state), whatever it is called. */
export function gameAt(dir: string, name: string, slug: string): Game {
  return { name, slug, dir, scoutFile: join(dir, SCOUT_FILE), rulesPdf: join(dir, RULES_PDF), picturesDir: join(dir, PICTURES_DIR) }
}

/**
 * What a call knows that the step does not: the name of Composio's server in a tool name, the documents the gate showed (for the call that publishes them) and the folder of
 * the specs of the games (`docs/games` of the checkout).
 */
export type PolicyExtras = { composioServer: string; publishIds: readonly string[]; gamesDocs: string }

type StepBase = {
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
  /** the step works in the game's folder of the repo (`games/<slug>`, which `game-new` makes): the command stops before it while the game has none */
  needsFolder?: boolean
}

/** One call that works alone (`claude -p`), bounded by what its policy allows. */
export type HeadlessStep = StepBase & {
  mode: "headless"
  /** whether the step uses Composio (its two lookup tools are allowed by name, the executor only through the hook) */
  composio: boolean
  policy: (game: Game, repoRoot: string, extras: PolicyExtras) => Policy
}

/** A session of Claude Code in the owner's terminal: the owner approves each action, and what they find at the gate is the machine's check of the result. */
export type SessionStep = StepBase & {
  mode: "session"
  /** where the files of the session are, for the owner to look at: `o` at the gate opens it */
  folder: (game: Game) => string
}

export type StepDefinition = HeadlessStep | SessionStep

export const SCOUT: HeadlessStep = {
  id: "scout",
  mode: "headless",
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

export const CATALOG_ENTRY: HeadlessStep = {
  id: "catalog-entry",
  mode: "headless",
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

export const RULES_SPEC: HeadlessStep = {
  id: "rules-spec",
  mode: "headless",
  title: "rules spec",
  skill: "game-rules-spec",
  lane: "Game lane",
  skillFile: ".claude/skills/game-rules-spec/SKILL.md",
  gates: ["validate"],
  // the scout file says which rulebook and which game; the rulebook itself is `rules.pdf` next to it, which the command fetched before the call
  prompt: (game) => `/game-rules-spec ${game.scoutFile}`,
  composio: false,
  // the one step that writes in the repo, and only two files of it: the page of the spec and its landing page in the docs (they are left uncommitted: the game's first pull request
  // takes them). It reads the scout file and the rulebook, never another file outside the repo, and runs the check of this game's spec and nothing else of the project.
  policy: (game, repoRoot, extras) => {
    const files = specPathsOf(extras.gamesDocs, game.slug)
    return {
      repoRoot,
      workDir: game.dir,
      writeFiles: [files.rules, files.index],
      readFiles: [game.scoutFile, game.rulesPdf],
      bash: [rulesCheckRule(game.slug), BASH.checkScout, BASH.date, mkdirRule(files.dir)],
      composio: null,
    }
  },
}

export const PLATFORM_ASSETS: SessionStep = {
  id: "platform-assets",
  mode: "session",
  title: "platform assets",
  skill: "platform-assets",
  lane: "Platform lane",
  skillFile: ".claude/skills/platform-assets/SKILL.md",
  gates: ["validate"],
  // the skill finds the official pictures, the owner approves each download, and the pictures are placed in the entry and published in the session, after the owner's yes
  prompt: (game) => `/platform-assets ${game.scoutFile}`,
  folder: (game) => game.picturesDir,
}

export const GAME_ASSETS: SessionStep = {
  id: "game-assets",
  mode: "session",
  title: "game assets",
  skill: "game-assets",
  lane: "Game lane",
  skillFile: ".claude/skills/game-assets/SKILL.md",
  gates: ["validate"],
  // the game has its folder, its Sanity project and the slots of its seed: the skill sorts the owner's files into the art folder and the seed uploads them, in the session, after the owner's yes
  needsFolder: true,
  prompt: (game) => `/game-assets ${game.slug}`,
  folder: (game) => game.dir,
}

export const STEPS: readonly StepDefinition[] = [SCOUT, CATALOG_ENTRY, RULES_SPEC, PLATFORM_ASSETS, GAME_ASSETS]

/** The tools a call is allowed by name: the read-only ones. Everything that writes or runs something is allowed by the hook alone, so that a hook that does not load refuses it. */
export function allowedTools(step: HeadlessStep, composioPrefix: string): string[] {
  const tools = ["ToolSearch", "WebSearch", "WebFetch"]
  if (step.composio) tools.push(`${composioPrefix}COMPOSIO_SEARCH_TOOLS`, `${composioPrefix}COMPOSIO_GET_TOOL_SCHEMAS`)
  return tools
}

/** The first step that is not validated, `undefined` when the game is done. */
export function firstOpen(isValidated: (id: string) => boolean): StepDefinition | undefined {
  return STEPS.find((step) => !isValidated(step.id))
}
