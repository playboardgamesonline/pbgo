"use client"

import type { Family, Role } from "@courtisans/engine"
import { CrownIcon, ShieldIcon, SwordIcon, VenetianMaskIcon } from "lucide-react"
import { cn } from "@pgo/ui/utils"
import { useCourtisans } from "./context"

const ICONS: Record<Role, typeof CrownIcon> = { noble: CrownIcon, spy: VenetianMaskIcon, assassin: SwordIcon, guard: ShieldIcon }

export function RolePictogram({ role, className }: { role: Role; className?: string }) {
  const { catalog } = useCourtisans()
  const url = catalog.roles[role].pictogramUrl
  if (url) {
    return (
      <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--disgrace)] p-[2px] align-middle", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={catalog.roles[role].name} className="size-full object-contain" />
      </span>
    )
  }
  const Icon = ICONS[role]
  return <Icon className={cn("size-4", className)} aria-label={catalog.roles[role].name} />
}

export function FamilyPictogram({ family, className }: { family: Family; className?: string }) {
  const { catalog } = useCourtisans()
  const info = catalog.families[family]
  return (
    <span
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle", className)}
      style={{ backgroundColor: info.color }}
      title={info.name}
    >
      {info.pictogramUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.pictogramUrl} alt={info.name} className="size-[70%] object-contain" />
      ) : (
        <span className="font-display text-[0.6em] leading-none text-white">{info.name[0]}</span>
      )}
    </span>
  )
}
