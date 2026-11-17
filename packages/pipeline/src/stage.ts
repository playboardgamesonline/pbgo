// What the gate of a step that is a session of the owner's shows of `pnpm check:game <slug> --stage <stage>` (every check up to a stage) or `--only <stage>` (the checks of one stage): the one line that says
// whether the stage passes, then what stops it and what wants a look, from the report the script prints (`scripts/check-game.mjs`: a header for each stage, a line for each check, `✓` ok, `•` look at it, `✗`
// fail, then a summary). The exit code is the script's verdict; this only chooses what the owner reads.

/** The stages of a game, in order, and the gate a step has: every check up to a stage, or the checks of that stage alone. */
export const STAGES = ["scaffold", "engine", "binding", "board", "content", "live"] as const
export type Stage = (typeof STAGES)[number]
export type StageGate = { stage: Stage; only?: boolean }

const HEADER = /^(scaffold|engine|binding|board|content|live)( \((?:beyond the gate|not this gate)\))?$/
const CHECK = /^ {2}([✓•✗]) (.+)$/
const SUMMARY = /^\S+ has got as far as: .*\.$/

/** The arguments that make the script a gate for this step. */
export const gateArgs = (gate: StageGate): string[] => [gate.only ? "--only" : "--stage", gate.stage]

/**
 * The lines of a report that the owner reads at the gate: the summary first, then each check of the stages the gate counts that does not pass, `<stage>: <check>: <what it says>`, those that fail before those that want a look
 * (`look at <stage>: …`). A report with no summary (the script was refused: a game that does not exist, a wrong flag) is what it printed, its last lines.
 */
export function stageLines(report: string): string[] {
  const lines = report.split("\n").map((line) => line.trimEnd())
  let stage = ""
  let counts = false
  let summary: string | null = null
  const failing: string[] = []
  const looking: string[] = []
  for (const line of lines) {
    const header = HEADER.exec(line)
    if (header) {
      stage = header[1] ?? ""
      counts = header[2] === undefined
      continue
    }
    const check = CHECK.exec(line)
    if (check) {
      if (!counts || check[1] === "✓") continue
      const text = `${stage}: ${check[2]}`
      if (check[1] === "✗") failing.push(text)
      else looking.push(`look at ${text}`)
      continue
    }
    if (SUMMARY.test(line)) summary = line.trim()
  }
  if (summary === null) {
    const printed = lines.filter((line) => line.trim() !== "")
    return printed.length > 0 ? printed.slice(-8) : ["the check printed nothing"]
  }
  return [summary, ...failing, ...looking]
}
