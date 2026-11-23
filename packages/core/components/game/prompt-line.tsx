"use client"

import { motion } from "motion/react"
import { EASE_STANDARD, fade, type Motion, travel } from "../../lib/motion-preference"

/** There is a sentence to say: not nothing, not `false` (a condition that did not hold), not an empty string */
export const hasPrompt = (prompt: React.ReactNode) => prompt !== undefined && prompt !== null && prompt !== false && prompt !== ""

/**
 * What the viewer has to do now, as one sentence under the main line of the ticker (`Ticker`'s `prompt`). The table writes no sentence, so this is the one place a board's instruction is said: the game gives its own words, in the
 * visitor's language, while the viewer has something to do, and nothing when it has not.
 *
 * A sentence is read out in a polite live region when it changes, for visitors who do not see the screen, and the line itself is hidden from them so that it is not read twice. The region is always there, so that a change is announced. A
 * sentence that names a player gives the name as a `PlayerName`, which keeps it masked in recordings; the region is masked as a whole, as the announcements' is.
 */
export function PromptLine({ prompt, motionMode }: { prompt?: React.ReactNode; motionMode: Motion }) {
  const shown = hasPrompt(prompt)
  return (
    <>
      <div role="status" aria-live="polite" className="ph-mask sr-only">
        {shown ? prompt : null}
      </div>
      {shown && (
        <motion.p
          // a new sentence plays its entrance again; a node is one sentence for as long as it is given
          key={typeof prompt === "string" ? prompt : "prompt"}
          aria-hidden
          initial={{ opacity: 0, y: -travel(motionMode, 4) }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: fade(motionMode, 0.25), ease: EASE_STANDARD }}
          className="text-base leading-snug text-foreground/90 md:text-lg short:text-sm"
        >
          {prompt}
        </motion.p>
      )}
    </>
  )
}
