// The steps of adding a game, in order. A step is a skill of the repo (`.claude/skills/<skill>/SKILL.md`) that a sub-agent of `/add-game` carries out, the machine's check of what it left, and the gate the owner
// answers in the chat. This file is data: the skill reads it through `pnpm game-flow` (the brief of a step, its check, its place in Linear), and `add-game-skill.test.ts` keeps the table of the skill to it.
// A new step is a skill, an entry here and a row in the table of `.claude/skills/README.md`.
import { join } from "node:path"
import type { StageGate } from "./stage.ts"
import { PICTURES_DIR, RULES_PDF, SCOUT_FILE } from "./state.ts"

/** The game as the flow knows it: the name, the slug, its folder of working files, its scout file, the rulebook next to it and the folder of its pictures for the platform. */
export type Game = { name: string; slug: string; dir: string; scoutFile: string; rulesPdf: string; picturesDir: string }

export function gameOf(assets: string, name: string, slug: string): Game {
  return gameAt(join(assets, slug), name, slug)
}

/** A game whose folder is where it was found (the folder of its state), whatever it is called. */
export function gameAt(dir: string, name: string, slug: string): Game {
  return { name, slug, dir, scoutFile: join(dir, SCOUT_FILE), rulesPdf: join(dir, RULES_PDF), picturesDir: join(dir, PICTURES_DIR) }
}

/** The words the owner answers a gate with: `validate` says the work is right, `publish` is the one that makes drafts public. */
export type GateKind = "validate" | "publish"

/** What the machine says of a step once the sub-agent is done, and again when the owner validates. */
export type Check =
  /** the scout file exists, has the shape, and passes `pnpm check:scout <file> --online` */
  | { kind: "scout" }
  /** the documents the report says it publishes (`Validate publishes N documents (ids)`) are published, from the platform's public API */
  | { kind: "published" }
  /** the spec exists and passes `pnpm check:rules <slug> --name <name>` */
  | { kind: "rules" }
  /** the platform's public API shows the entry as published, with the pictures it has (`pnpm catalog:pictures <slug>`) */
  | { kind: "pictures" }
  /** the game's own seed can run on the art folder (`pnpm -C games/<slug> content:seed --dry-run --art-dir <folder>`) */
  | { kind: "art" }
  /** `pnpm check:game <slug> --stage <stage>` (every check up to a stage), or `--only <stage>` (that stage alone) */
  | { kind: "stage"; gate: StageGate }

/** What the owner's ok at the last gate does besides recording it. */
export type OnValidate = "settle-scout" | "stamp-rules"

export type StepDefinition = {
  id: string
  /** how the step is named in the chat and in Linear ("scout", "catalog entry") */
  title: string
  skill: string
  /** the lane label of its Linear issue */
  lane: "Game lane" | "Platform lane" | "Engine lane"
  /** the skill's file, relative to the repo */
  skillFile: string
  /** the gates after the step, in order: the first says the work is right, the next ones are the words that act (`publish`) */
  gates: GateKind[]
  /** the argument of the skill, as it is typed after its name */
  args: (game: Game) => string
  /** what the brief of the sub-agent adds for this step */
  notes: (game: Game) => string[]
  /** the step works in the game's folder of the repo (`games/<slug>`, which `game-new` makes): it waits while the game has none in this checkout */
  needsFolder?: boolean
  /** the step makes the game's folder in the repo: for a game that has it already there is nothing to make */
  makesFolder?: boolean
  check: Check
  onValidate?: OnValidate
}

export const SCOUT: StepDefinition = {
  id: "scout",
  title: "scout",
  skill: "game-scout",
  lane: "Game lane",
  skillFile: ".claude/skills/game-scout/SKILL.md",
  gates: ["validate"],
  // `--out` puts the file where the flow keeps the game's files, whatever the slug the scout settles on: moving the folder is `validate`'s job
  args: (game) => `${game.name} --out ${game.scoutFile}`,
  notes: (game) => [
    `The scout file goes to \`${game.scoutFile}\` (the skill's \`--out\`), whatever slug you settle on: the orchestrator moves the game's folder when the owner validates.`,
    "The skill cannot ask in the middle and neither can you: its defaults answer every question, and what the owner may want to change goes in your report.",
  ],
  check: { kind: "scout" },
  onValidate: "settle-scout",
}

export const CATALOG_ENTRY: StepDefinition = {
  id: "catalog-entry",
  title: "catalog entry",
  skill: "platform-catalog-entry",
  lane: "Platform lane",
  skillFile: ".claude/skills/platform-catalog-entry/SKILL.md",
  // the first gate says the drafts are right; the second is the word that makes them public
  gates: ["validate", "publish"],
  args: (game) => game.scoutFile,
  notes: () => [
    "Stop at the drafts: the report gives the Studio link of each draft and, in the skill's own sentence, `Validate publishes N documents (id, id)`: the orchestrator reads that sentence and shows the owner those ids.",
    "Publish only when the orchestrator sends you the owner's explicit yes to publish, and then exactly the documents of that sentence: read them back from Sanity and report.",
  ],
  check: { kind: "published" },
}

export const RULES_SPEC: StepDefinition = {
  id: "rules-spec",
  title: "rules spec",
  skill: "game-rules-spec",
  lane: "Game lane",
  skillFile: ".claude/skills/game-rules-spec/SKILL.md",
  gates: ["validate"],
  // the scout file says which rulebook and which game; the rulebook itself is `rules.pdf` next to it, which the orchestrator fetched before the call
  args: (game) => game.scoutFile,
  notes: (game) => [
    `The rulebook is the PDF at \`${game.rulesPdf}\` when it is there: \`Read\` it whole, with no \`pages\`. When it is not there and the rules are a PDF, answer \`STATUS: blocked\` and say where it has to be.`,
    `Write only \`docs/games/${game.slug}/rules.md\` and \`docs/games/${game.slug}/index.md\`, and leave them uncommitted: the game's first pull request takes them.`,
    "Your SUMMARY is the skill's own report whole, with its open points, each with the reading you propose: the owner's ok accepts every reading, and the orchestrator shows them each.",
  ],
  check: { kind: "rules" },
  onValidate: "stamp-rules",
}

export const PLATFORM_ASSETS: StepDefinition = {
  id: "platform-assets",
  title: "platform assets",
  skill: "platform-assets",
  lane: "Platform lane",
  skillFile: ".claude/skills/platform-assets/SKILL.md",
  gates: ["validate"],
  args: (game) => game.scoutFile,
  notes: (game) => [
    `The pictures are brought into \`${game.picturesDir}\`, with their sources written down. Every download, every upload and the publication need the owner's yes: stop with \`STATUS: questions\` before each, saying what, from where, how many files and where it goes.`,
  ],
  check: { kind: "pictures" },
}

export const GAME_NEW: StepDefinition = {
  id: "game-new",
  title: "game folder",
  skill: "game-new",
  lane: "Game lane",
  skillFile: ".claude/skills/game-new/SKILL.md",
  gates: ["validate"],
  // the folder of the game from the template, its Sanity project and its Studio: the skill shows what leaves the machine and creates it only after an explicit ok
  args: (game) => `${game.slug} (the game is called "${game.name}"; its rulebook is the PDF at ${game.rulesPdf} when there is one; its rules spec, when there is one, is docs/games/${game.slug}/)`,
  notes: (game) => [
    `The name, the slug, the rulebook and the rules spec are given: do not ask for them again. The rules spec in \`docs/games/${game.slug}/\` goes into the game's first commit with the game.`,
    "Everything that creates something outside the repo (a Sanity project, a token, the Studio, `pnpm setup-env`) waits for an explicit yes that the orchestrator relays: stop with `STATUS: questions` first, with the list of what leaves the machine.",
  ],
  makesFolder: true,
  check: { kind: "stage", gate: { stage: "scaffold" } },
}

export const GAME_SANITY_CREATE: StepDefinition = {
  id: "game-sanity-create",
  title: "studio forms",
  skill: "game-sanity-create",
  lane: "Game lane",
  skillFile: ".claude/skills/game-sanity-create/SKILL.md",
  gates: ["validate"],
  args: (game) => game.slug,
  notes: () => ["The plan of the fields is the owner's to approve: stop with it as `STATUS: questions` before you write a schema."],
  needsFolder: true,
  // the stage of the content alone: the engine is not written yet, which `--stage content` would count
  check: { kind: "stage", gate: { stage: "content", only: true } },
}

export const GAME_ASSETS: StepDefinition = {
  id: "game-assets",
  title: "game assets",
  skill: "game-assets",
  lane: "Game lane",
  skillFile: ".claude/skills/game-assets/SKILL.md",
  gates: ["validate"],
  // the game has its folder, its Sanity project and the slots of its seed: the skill sorts the owner's files into the art folder and the seed uploads them, after the owner's yes
  args: (game) => game.slug,
  notes: (game) => [
    `The art folder is \`${game.dir}\`: each file is named after a slot of the game's seed. Never make, edit, crop or upscale a picture; the upload happens only after the owner's yes.`,
  ],
  needsFolder: true,
  check: { kind: "art" },
}

export const ENGINE_RULES: StepDefinition = {
  id: "engine-rules",
  title: "engine",
  skill: "engine-rules",
  lane: "Engine lane",
  skillFile: ".claude/skills/engine-rules/SKILL.md",
  gates: ["validate"],
  args: (game) => game.slug,
  notes: (game) => [
    `The rules spec \`docs/games/${game.slug}/rules.md\` is the source: its open points were validated with it, so do not ask the owner for them again. The plan and each slice's pull request wait for the owner's go: stop with \`STATUS: questions\`.`,
  ],
  needsFolder: true,
  check: { kind: "stage", gate: { stage: "engine" } },
}

export const ENGINE_BOARD: StepDefinition = {
  id: "engine-board",
  title: "board",
  skill: "engine-board",
  lane: "Engine lane",
  skillFile: ".claude/skills/engine-board/SKILL.md",
  gates: ["validate"],
  args: (game) => game.slug,
  notes: () => ["Each slice is a pull request that waits for the owner's go: stop with `STATUS: questions`. The look of the board is the owner's to approve from what you describe, never from a screenshot in a pull request."],
  needsFolder: true,
  check: { kind: "stage", gate: { stage: "board" } },
}

export const GAME_GO_LIVE: StepDefinition = {
  id: "game-go-live",
  title: "go live",
  skill: "game-go-live",
  lane: "Game lane",
  skillFile: ".claude/skills/game-go-live/SKILL.md",
  gates: ["validate"],
  args: (game) => game.slug,
  notes: () => ["Turning the switches (`live`, `indexable`) is a pull request that waits for the owner's explicit go, and nothing is merged by you."],
  needsFolder: true,
  // every stage, the flags of the registry included: they are on in the checkout once the pull request that turns them on is merged and the branch is updated
  check: { kind: "stage", gate: { stage: "live" } },
}

export const STEPS: readonly StepDefinition[] = [SCOUT, CATALOG_ENTRY, RULES_SPEC, PLATFORM_ASSETS, GAME_NEW, GAME_SANITY_CREATE, GAME_ASSETS, ENGINE_RULES, ENGINE_BOARD, GAME_GO_LIVE]

export function stepById(id: string): StepDefinition | undefined {
  return STEPS.find((step) => step.id === id)
}

/** The first step that is not validated, `undefined` when the game is done. */
export function firstOpen(isValidated: (id: string) => boolean): StepDefinition | undefined {
  return STEPS.find((step) => !isValidated(step.id))
}
