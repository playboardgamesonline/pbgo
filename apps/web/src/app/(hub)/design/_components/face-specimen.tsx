"use client"

import { Code } from "./layout"
import { useMeasured } from "./live"
import { ratio } from "./type-scale"

const SAMPLE = "BOARD GAMES & PBGO 0123"

/**
 * One display face on a line of its own: its utility, the typeface and the weight the browser computed for it, its size over its parent's (the
 * scale that gives it the cap height of Geist's capitals), the package it comes from and the letter of the logo that is drawn in it. Everything
 * is read from the sample, nothing is typed here but the names.
 */
export function FaceRow({ face, letter, fontsource }: { face: string; letter: string; fontsource: string }) {
  const { ref: parentRef, values: parentValues } = useMeasured(["font-size"])
  const { ref: ownRef, values: ownValues } = useMeasured(["font-family", "font-weight", "font-size"])
  const [family, weight, size] = ownValues
  return (
    <div className="grid gap-x-8 gap-y-3 py-6 first:pt-0 last:pb-0 md:grid-cols-[16rem_1fr]">
      <div className="flex flex-col gap-2">
        <Code className="w-fit">{face}</Code>
        <p className="text-sm text-muted-foreground">
          {family ? (
            <>
              {family.split(",")[0]?.replaceAll('"', "")} · {weight} · ×{ratio(size ?? "", parentValues[0] ?? "")}
            </>
          ) : (
            "…"
          )}
        </p>
        <p className="text-sm text-muted-foreground">The {letter} of the logo</p>
        <p>
          <Code>{fontsource}</Code>
        </p>
      </div>
      <p ref={parentRef} className="text-3xl leading-tight break-words">
        <span ref={ownRef} className={face}>
          {SAMPLE}
        </span>
      </p>
    </div>
  )
}
