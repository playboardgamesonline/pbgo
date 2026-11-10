"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { AgeRefusal } from "@pbgo/accounts"
import { isPlatformLanguage } from "@pbgo/accounts/language"
import { trackClient } from "@pbgo/analytics/client"
import { createApi } from "@pbgo/core/lib/api"
import { engineOptionsOf } from "@pbgo/core/lib/table-options"
import type { TableSettingsInput } from "@pbgo/core/lib/table-settings"
import type { LobbyAccessValue } from "@pbgo/ui/platform/lobby-access"
import { LobbyDetail, type LobbyDetailProps } from "@pbgo/ui/platform/lobby-panel"
import { SPEEDS } from "@pbgo/ui/tables"
import { useAgeGate } from "./age-gate"

// The lobby the visitor sits at, in the panel beside the open tables: the details of the table as the page worded them (`ownTableDetail`: the seats, the settings, the button that starts the game or the one that waits for the host, the one that leaves it),
// and, for the one who opened it, the settings wired to the game's routes (PLT-106, PLT-21). A choice of the settings goes where it is kept: the engine's own options (`games.options`) when its id is the key of one (`engineOptionsOf`, the options route), and
// the settings of the table (`games.settings`, the settings route) for who may join, the speed and the number of players. The host's panel sends them all at once, so that what it shows is what is kept; the calls go one after the other, so that a choice
// made after another is never overtaken by it. When the server refuses one (an expansion for adults, with somebody seated who is not old enough; fewer seats than people), the panel starts again from what the table holds.

export function OwnLobby({
  slug,
  code,
  detail,
  optionKeys,
  offered,
  table,
  flat = false,
  className,
}: {
  slug: string
  code: string
  detail: Omit<LobbyDetailProps, "onClose">
  /** The keys of the options the table holds, which are the engine's. */
  optionKeys: readonly string[]
  /** The ids of the expansions and the helpers that the settings offer. */
  offered: { expansions: readonly string[]; helpers: readonly string[] }
  /** What the table is set to now: who may join, the speed, the seats. */
  table: TableSettingsInput
  flat?: boolean
  className?: string
}) {
  const router = useRouter()
  const { guard, demand, fail, dialog } = useAgeGate()
  // The settings of the table as the panel shows them, and the calls that keep them, one after the other
  const kept = useRef<TableSettingsInput>(table)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  // The settings draw a choice before the server has answered it: when the server refuses, they start again from what the table holds. The page asks for it again (`reset`) and the panel is drawn anew once it has arrived
  const [restart, setRestart] = useState(0)
  const [refreshing, startRefresh] = useTransition()
  const resetting = useRef(false)
  useEffect(() => {
    if (refreshing || !resetting.current) return
    resetting.current = false
    kept.current = table
    setRestart((count) => count + 1)
  }, [refreshing, table])
  const reset = () => {
    resetting.current = true
    startRefresh(() => router.refresh())
  }

  const save = (patch: Partial<TableSettingsInput>) => {
    const next = { ...kept.current, ...patch }
    kept.current = next
    queue.current = queue.current
      .then(() => createApi(slug).settings(code, next))
      .then(
        () => undefined,
        (error) => {
          fail(error)
          reset()
        },
      )
  }

  const settings = detail.settings
    ? {
        ...detail.settings,
        onChange: (value: { expansions: string[]; helpers: string[]; pace: string }) => {
          // The speed is a setting of the table; a pace the lobby does not offer is never sent
          if (value.pace !== kept.current.pace && (SPEEDS as readonly string[]).includes(value.pace)) save({ pace: value.pace as TableSettingsInput["pace"] })
          const options = engineOptionsOf(value, offered, optionKeys)
          if (Object.keys(options).length === 0) return
          guard(() => createApi(slug).options(code, options)).catch((error) => {
            fail(error)
            reset()
          })
        },
        // An expansion for adults that the visitor cannot choose: say why, or ask for the date of birth (PLT-125)
        onLockedPick: (_id: string, locked: { kind?: string }) => void demand(locked.kind as AgeRefusal),
      }
    : detail.settings
  // Who may join, from the button at the top right of the panel: the rank and the language are kept whether the table is public or not, for the day it is
  const access = detail.access && {
    ...detail.access,
    onChange: ({ visibility, minRank, language }: LobbyAccessValue) => save({ visibility, minRank, language: language !== null && isPlatformLanguage(language) ? language : null }),
  }
  // The link is the invitation: counting its copies is what the game's own lobby did
  const invite = detail.invite && { ...detail.invite, onCopy: () => trackClient("invite_link_copied", { game: slug }) }
  return (
    <>
      <LobbyDetail key={`${code}:${restart}`} {...detail} settings={settings} access={access} onPlayersChange={detail.playerRange ? (seats) => save({ seats }) : undefined} invite={invite} flat={flat} className={className} />
      {dialog}
    </>
  )
}
