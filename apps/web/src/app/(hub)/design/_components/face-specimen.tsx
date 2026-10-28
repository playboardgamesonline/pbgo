"use client"

import { Code } from "./layout"
import { useMeasured } from "./live"
import { ratio } from "./type-scale"

const SAMPLE = "ABCDEFGHIJKLM NOPQRSTUVWXYZ & 0123456789"

/**
 * One face of `LetterMix` on a line of its own: its utility, the typeface and the weight the browser computed for it, and its size over its
 * parent's (the scale that gives it the cap height of Geist's capitals). Everything is read from the sample, nothing is typed here.
 */
export function FaceRow({ face, fontsource }: { face: string; fontsource: string }) {
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
