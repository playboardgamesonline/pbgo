"use client"

import * as React from "react"
import { GlobeIcon, LockIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { ToggleGroup, ToggleGroupItem } from "./toggle-group"

// Who may find a lobby, as two icons in a toggle at the top right of its panel: a globe for a table that is listed with the open tables (`public`), a lock for one that is reached by its link alone (`private`). A lobby is always one of the two, so pressing
// the icon that is on leaves it on. Each icon has its name for a screen reader and for the pointer, and the group is named "Who can find the table". Only a lobby that is opened or set has it (`LobbyDetail` for the visitor's own, and the space that opens one): every table
// of the list is public. While a lobby is public its settings add the criteria that restrict who may sit at it (a minimum rank, a language: `LobbySettings`), so the toggle and those settings share what is chosen, which is what `LobbyAccess` around the panel is for: without
// one the toggle keeps its own. Nothing is kept yet (no lobby has a place to keep it: the tables of PLT-13), so what is set stays in the page; `onValueChange` is for the page that has somewhere to put it.

type LobbyVisibilityValue = "public" | "private"

type LobbyAccessState = { visibility: LobbyVisibilityValue; setVisibility: (next: LobbyVisibilityValue) => void }

const LobbyAccessContext = React.createContext<LobbyAccessState | null>(null)

/** Wraps a panel whose lobby the visitor sets: who may find it is kept here, for the toggle at its top and the criteria in its settings, which only a public lobby asks for. */
function LobbyAccess({ defaultVisibility = "public", children }: { defaultVisibility?: LobbyVisibilityValue; children: React.ReactNode }) {
  const [visibility, setVisibility] = React.useState<LobbyVisibilityValue>(defaultVisibility)
  const state = React.useMemo(() => ({ visibility, setVisibility }), [visibility])
  return <LobbyAccessContext value={state}>{children}</LobbyAccessContext>
}

/** Who may find the lobby that the surrounding `LobbyAccess` is about; null outside one. */
function useLobbyAccess(): LobbyAccessState | null {
  return React.useContext(LobbyAccessContext)
}

type LobbyVisibilityProps = Omit<React.ComponentProps<typeof ToggleGroup>, "type" | "value" | "defaultValue" | "onValueChange" | "children"> & {
  /** What it is set to when it is drawn, outside a `LobbyAccess` (inside one, the `LobbyAccess` says): the table's own, or `public` for a lobby that is about to be opened. */
  defaultValue?: LobbyVisibilityValue
  onValueChange?: (value: LobbyVisibilityValue) => void
}

function LobbyVisibility({ defaultValue = "public", onValueChange, className, ...props }: LobbyVisibilityProps) {
  const access = useLobbyAccess()
  const [own, setOwn] = React.useState<LobbyVisibilityValue>(defaultValue)
  const value = access ? access.visibility : own
  return (
    <ToggleGroup
      data-slot="lobby-visibility"
      type="single"
      value={value}
      // Pressing the icon that is on reports an empty value: a lobby is always one of the two, so it is ignored
      onValueChange={(next) => {
        if (next !== "public" && next !== "private") return
        if (access) access.setVisibility(next)
        else setOwn(next)
        onValueChange?.(next)
      }}
      aria-label="Who can find the table"
      className={cn("flex-nowrap", className)}
      {...props}
    >
      <ToggleGroupItem value="public" aria-label="Public" title="Public: listed with the open tables" className="w-8 px-0">
        <HugeiconsIcon icon={GlobeIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
      </ToggleGroupItem>
      <ToggleGroupItem value="private" aria-label="Private" title="Private: reached by its link" className="w-8 px-0">
        <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-4" aria-hidden="true" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export { LobbyAccess, LobbyVisibility, useLobbyAccess }
export type { LobbyAccessState, LobbyVisibilityProps, LobbyVisibilityValue }
