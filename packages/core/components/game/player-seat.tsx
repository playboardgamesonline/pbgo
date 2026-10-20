"use client"

import { useMemo } from "react"
import { seatAvatar } from "../../lib/seat-avatar"
import { useGame } from "./context"
import { SeatAvatarMark, SeatLabel, type SeatLabelProps } from "./seat-label"

/** The seat label of a player of the table: nickname, seat colour and account picture come from the game. */
export function PlayerSeatLabel({ playerId, ...props }: { playerId: string } & Omit<SeatLabelProps, "nickname" | "color" | "imageUrl">) {
  const { nickname, color, avatarUrl } = useGame()
  return <SeatLabel nickname={nickname(playerId)} color={color(playerId)} imageUrl={avatarUrl(playerId)} {...props} />
}

/** The avatar alone of a player of the table (the announcements, the game over medallion). */
export function PlayerAvatar({ playerId, ...props }: { playerId: string } & Omit<Parameters<typeof SeatAvatarMark>[0], "avatar">) {
  const { nickname, color, avatarUrl } = useGame()
  const name = nickname(playerId)
  const seatColor = color(playerId)
  const imageUrl = avatarUrl(playerId)
  const avatar = useMemo(() => seatAvatar({ nickname: name, color: seatColor, imageUrl }), [name, seatColor, imageUrl])
  return <SeatAvatarMark avatar={avatar} {...props} />
}
