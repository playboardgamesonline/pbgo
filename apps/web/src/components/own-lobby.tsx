"use client"

import { createApi } from "@pbgo/core/lib/api"
import { engineOptionsOf } from "@pbgo/core/lib/table-options"
import { LobbyDetail, type LobbyDetailProps } from "@pbgo/ui/platform/lobby-panel"
import { toast } from "@pbgo/ui/platform/sonner"
import { messageOf } from "@/lib/table-door"

// The lobby the visitor sits at, in the panel beside the open tables: the details of the table as the page worded them (`ownTableDetail`: the seats, the settings, the button that starts the game or the one that waits for the host, the one that leaves it), and,
// for the one who opened it, the settings wired to the game's options route (PLT-106). The engine keeps its own options only (`games.options`), so a choice of the settings is sent when its id is the key of one (`engineOptionsOf`) and stays in the page when it is
// not: the number of players, who may join and the speed have no place in a row of `games` until PLT-13's tables.

export function OwnLobby({
  slug,
  code,
  detail,
  optionKeys,
  offered,
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
  flat?: boolean
  className?: string
}) {
  const settings = detail.settings
    ? {
        ...detail.settings,
        onChange: (value: { expansions: string[]; helpers: string[] }) => {
          const options = engineOptionsOf(value, offered, optionKeys)
          if (Object.keys(options).length > 0) createApi(slug).options(code, options).catch((error) => toast.error(messageOf(error)))
        },
      }
    : detail.settings
  return <LobbyDetail key={code} {...detail} settings={settings} flat={flat} className={className} />
}
