import type { Metadata } from "next"
import { Playground } from "./playground"

const DESCRIPTION = "Every component of the table on one table, to move, tune and play with."

export const metadata: Metadata = { title: "Playground", description: DESCRIPTION, alternates: { canonical: "/docs/playground" } }

/**
 * The playground, an interface of its own: the table fills the window, with the controls at its side, and nothing of a doc's shell (no side menu, no navbar). It sits beside the docs, not in one, so its address is `/docs/playground`, and it
 * is `noindex` and out of the analytics like all of them (`docs/layout.tsx`, `isExcludedPath`). The docs reach it from their hub and from the top of the engine doc.
 */
export default function PlaygroundPage() {
  return <Playground />
}
