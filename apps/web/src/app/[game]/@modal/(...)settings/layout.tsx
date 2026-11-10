import type { ReactNode } from "react"
import { SettingsFrame } from "@/components/settings-frame"

/** The settings drawn over a game's screen, when a link of the site leads to `/settings/**` from it (`GAME_SETTINGS_PATH`: the alias of `/me/settings/**` that the games' window answers): the same window as the hub's (`app/(hub)/@modal/(.)me/settings`), with the board left under it. */
export default function GameSettingsOverlayLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SettingsFrame over>{children}</SettingsFrame>
}
