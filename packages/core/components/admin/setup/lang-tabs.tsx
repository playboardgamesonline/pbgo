"use client"

import { cn } from "@pbgo/ui/utils"
import { LOCALES, type Locale } from "../../../lib/i18n"

/** Sélecteur de langue des pages Setup (FR / EN / ES / DE) : `filled` marque les langues déjà renseignées. */
export function LangTabs({ value, onChange, filled, className }: { value: Locale; onChange: (l: Locale) => void; filled?: Partial<Record<Locale, number | boolean>>; className?: string }) {
  return (
    <div role="tablist" aria-label="Language" className={cn("inline-flex gap-1 rounded-lg bg-muted p-1", className)}>
      {LOCALES.map((l) => {
        const f = filled?.[l]
        return (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={value === l}
            onClick={() => onChange(l)}
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground uppercase transition-colors hover:text-foreground",
              value === l && "bg-background text-foreground shadow-xs",
            )}
          >
            {l}
            {typeof f === "number" && f > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground tabular-nums">{f}</span>}
            {f === true && <span className="size-1.5 rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}
