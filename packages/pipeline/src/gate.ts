// What the owner can type at a gate. The words of the skills' own gates ("a clear yes ends the step; silence is not one, and neither is an answer
// that mixes a yes and a change: that one is a change") are kept: a yes is one of the words below and nothing else, an empty line is not a yes.

/** The kinds of gate: `validate` (the work is right, or a message says what to change) and `publish` (the one word that makes something public). */
export type GateKind = "validate" | "publish"

export const YES_WORDS: readonly string[] = ["validate", "v", "yes", "y", "ok", "oui", "go"]

export type Answer =
  | { kind: "validate" }
  | { kind: "publish" }
  | { kind: "quit" }
  | { kind: "open" }
  | { kind: "back" }
  | { kind: "change"; text: string }
  /** an empty line: it is not a yes */
  | { kind: "empty" }
  /** something the gate does not take (said in `hint`) */
  | { kind: "unknown"; hint: string }

/** What a line typed at a gate means. A word is compared without its case and without the punctuation that ends a sentence. */
export function parseAnswer(raw: string, gate: GateKind): Answer {
  const text = raw.trim()
  if (text === "") return { kind: "empty" }
  const word = text.toLowerCase().replace(/[.!]+$/, "")
  if (word === "q" || word === "quit") return { kind: "quit" }
  if (word === "o" || word === "open") return { kind: "open" }
  if (gate === "publish") {
    if (word === "publish") return { kind: "publish" }
    if (word === "b" || word === "back") return { kind: "back" }
    return { kind: "unknown", hint: "Type publish to publish, b to go back and change something, q to stop." }
  }
  if (YES_WORDS.includes(word)) return { kind: "validate" }
  if (word === "publish") return { kind: "unknown", hint: "validate comes first: publish is asked once the work is validated." }
  return { kind: "change", text }
}
