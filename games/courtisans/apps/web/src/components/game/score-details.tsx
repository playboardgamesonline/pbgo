"use client"

import type { CourtisansPlayerResult } from "@courtisans/engine"
import type { ResultDetailRenderer } from "@pgo/core/components/game/game-over"
import { cn } from "@pgo/ui/utils"
import { useCourtisans } from "./context"

/** Détail des points d'un joueur en fin de partie : une mini-carte par famille, puis les missions réussies. */
export function FamilyCards({ j, large, center }: { j: CourtisansPlayerResult; large?: boolean; center?: boolean }) {
  const { catalog } = useCourtisans()
  const succeeded = j.missions.filter((m) => m.done).length
  const missionPoints = j.missions.reduce((t, m) => t + m.points, 0)
  const size = large ? "h-10 w-7 text-sm" : "h-8 w-[1.4rem] text-[0.68rem]"
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`
  return (
    <div className={cn("flex flex-wrap items-center", center ? "justify-center" : "justify-start", large ? "gap-2" : "gap-1.5")}>
      {j.families
        .filter((d) => d.weight > 0)
        .map((d) => (
          <span
            key={d.family}
            title={`${catalog.families[d.family].name} : ${sign(d.points)}`}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-[0.3rem] border border-white/20 font-display font-bold text-white/95 tabular-nums shadow-[0_3px_8px_rgb(0_0_0/30%)] [text-shadow:0_1px_2px_rgb(0_0_0/50%)]",
              size,
            )}
            style={{ backgroundColor: `color-mix(in oklab, ${catalog.families[d.family].color} 62%, #56686c)`, opacity: d.points === 0 ? 0.45 : 1 }}
          >
            {sign(d.points)}
          </span>
        ))}
      {succeeded > 0 && (
        <span
          title={`Missions réussies : ${succeeded}/${j.missions.length} (${sign(missionPoints)})`}
          className={cn("relative ml-3 shrink-0", large ? "h-10" : "h-9", succeeded > 1 ? (large ? "w-[5.4rem]" : "w-[5rem]") : large ? "w-12" : "w-12")}
        >
          {j.missions
            .map((m, i) => ({ ...m, blue: i === 1 }))
            .filter((m) => m.done)
            .map((m, i, list) => (
              <span
                key={m.missionId}
                className={cn(
                  "absolute flex items-center justify-center rounded-[0.3rem] border font-display font-bold tabular-nums shadow-[0_3px_8px_rgb(0_0_0/35%)]",
                  large ? "h-8 w-12 text-sm" : "h-7 w-12 text-xs",
                  m.blue ? "border-[#d9bf7a]/60 bg-[#0c2a31] text-[#e7cf8a]" : "border-[#cdb888]/70 bg-[#f1e8d0] text-[#3b2a08]",
                  list.length > 1 ? (i === 0 ? "top-0 left-0 -rotate-6" : "right-0 bottom-0 rotate-[5deg]") : "inset-x-0 top-1/2 -translate-y-1/2",
                )}
              >
                {sign(m.points)}
              </span>
            ))}
        </span>
      )}
    </div>
  )
}


/** `renderDetail` du tableau de fin commun (@pgo/core GameOver). */
export const renderFamilyCards: ResultDetailRenderer = (result, { large, centered }) => (
  <FamilyCards j={result as CourtisansPlayerResult} large={large} center={centered} />
)
