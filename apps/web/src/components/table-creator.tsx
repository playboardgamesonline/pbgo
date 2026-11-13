"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { createApi } from "@pbgo/core/lib/api"
import { engineOptionsOf } from "@pbgo/core/lib/table-options"
import { creationSettings, OPEN_TO_ANYONE, type AccessChoice } from "@pbgo/core/lib/table-settings"
import { Button } from "@pbgo/ui/platform/button"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { LobbyAccess, type LanguageOption } from "@pbgo/ui/platform/lobby-access"
import { LobbyPanel } from "@pbgo/ui/platform/lobby-panel"
import { LobbyPlayers } from "@pbgo/ui/platform/lobby-players"
import { LobbySettings, type ExpansionOption, type HelperOption, type LobbySettingsValue } from "@pbgo/ui/platform/lobby-settings"
import { defaultSeats } from "@pbgo/ui/tables"
import type { AgeRefusal } from "@pbgo/accounts"
import { useAgeGate } from "./age-gate"
import { useSitDown } from "./sit-down"

// The space to open a table, in the panel beside the open tables, for a visitor who sits at none (PLT-106). The number of players, who may join and the settings of the game are drawn as the lobby that follows has them (`LobbyPlayers`, `LobbyAccess`, `LobbySettings`), and
// the one button opens the table: the game's own route creates it (`POST /api/<slug>/games`, which sits the visitor down as their account, or under the nickname a guest is asked for first) with what the host chose of who may join, the speed and the number of
// players (PLT-21, `creationSettings`), the settings that the game's engine keeps are sent right after it (the options route, `engineOptionsOf`), then the page asks again where the visitor sits and the panel becomes their lobby. A game that is not live has the same space, as it is for the others, and a button that does nothing and says "Coming soon" under its label (`live`).

const TITLE = "text-3xl md:text-4xl"

export function TableCreator({
  slug,
  live,
  range,
  expansions,
  helpers,
  languages,
  signedIn,
  flat = false,
  className,
}: {
  slug: string
  live: boolean
  /** How many players a lobby may be set for: from the game's least to its most. */
  range: { min: number; max: number }
  expansions: readonly ExpansionOption[]
  helpers: readonly HelperOption[]
  languages: readonly LanguageOption[]
  /** Whether the visitor is signed in: the server sits them down as their account, and no nickname is asked. */
  signedIn: boolean
  /** The panel stands inside the container of the open tables and draws no surface of its own (`LobbyPanel`). */
  flat?: boolean
  className?: string
}) {
  const router = useRouter()
  const { sitDown, dialog } = useSitDown(slug, signedIn)
  const { guard, demand, fail, dialog: ageDialog } = useAgeGate()
  const [settings, setSettings] = useState<LobbySettingsValue | null>(null)
  // Who may join and how many players, as the panel shows them: they go with the table when it is opened
  const [access, setAccess] = useState<AccessChoice>(OPEN_TO_ANYONE)
  const [seats, setSeats] = useState<number | null>(null)
  const [opening, setOpening] = useState(false)

  async function open() {
    const who = await sitDown()
    if (!who) return
    setOpening(true)
    try {
      const api = createApi(slug)
      // A game for adults asks for the date of birth when it is missing (PLT-125): the visitor gives it, and the call goes on
      const table = await guard(() => api.create(who, creationSettings(access, settings?.pace ?? "normal", seats, range)))
      // What the lobby was set to before it existed: the engine keeps its own options (sent right after the table exists); who may join, the speed and the seats went with the table
      const options = settings ? engineOptionsOf(settings, { expansions: expansions.map(({ id }) => id), helpers: helpers.map(({ id }) => id) }, Object.keys(table.options)) : {}
      if (Object.keys(options).length > 0) await guard(() => api.options(table.code, options)).catch(fail)
      router.refresh()
    } catch (error) {
      fail(error)
      setOpening(false)
    }
  }

  const label = (
    <>
      Open a table
      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
    </>
  )
  return (
    <LobbyPanel flat={flat} className={className}>
      <CardHeader>
        <CardTitle className={TITLE}>Create a table</CardTitle>
        <CardDescription className="text-base">Open a table, share its link and play with your friends.</CardDescription>
        <CardAction>
          <LobbyAccess languages={languages} onChange={setAccess} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col">
        <div className="flex flex-col gap-6 border-t pt-6">
          <LobbyPlayers range={range} defaultCount={defaultSeats(range.min, range.max)} onCountChange={setSeats} />
          <LobbySettings expansions={expansions} helpers={helpers} pace="normal" editable onChange={setSettings} onLockedPick={(_id, locked) => void demand(locked.kind as AgeRefusal)} />
        </div>
      </CardContent>
      <CardFooter>
        {live ? (
          <Button size="xl" className="w-full" disabled={opening} onClick={open}>
            {label}
          </Button>
        ) : (
          // The way in of a game that is not live does nothing, and is lit like the others: what it would say, then, under it, that it is coming
          <Button size="xl" className="w-full flex-col gap-0 disabled:opacity-100" disabled>
            <span className="flex items-center gap-2 leading-5">{label}</span>
            <span className="text-xs leading-4 opacity-70">Coming soon</span>
          </Button>
        )}
      </CardFooter>
      {dialog}
      {ageDialog}
    </LobbyPanel>
  )
}
