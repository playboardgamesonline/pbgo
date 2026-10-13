"use client"

import { useMemo, type ReactNode } from "react"
import { cn } from "@pbgo/ui/utils"
import { useOptionalBinding } from "../../lib/binding-context"
import { seatAvatar, type SeatAvatar } from "../../lib/seat-avatar"
import { seatTheme, type SeatTheme } from "../../lib/ui-theme"

/**
 * The seat label: a player's avatar and nickname, the same everywhere a player is named (strip of pending players, lobby,
 * announcements, game over; the 3D tables draw the same avatar from `lib/seat-avatar-canvas.ts`). Pure presentation, no game
 * context: `player-seat.tsx` feeds it from the game, `/design` with samples. A game tunes it through `UI_THEME.seat` of its
 * binding (shape, ring, font, nickname colour), never by restyling the component.
 *
 * The avatar is generated from the nickname and the seat colour. When the player has an account picture (`imageUrl`, PLT-13) the
 * picture replaces the generated one, and nothing else changes.
 */

export type SeatSize = "xs" | "sm" | "md" | "lg" | "xl"

// The `short` variant (viewport height) is the compact layout of a phone held sideways
const SIZES: Record<SeatSize, string> = {
  xs: "size-4 text-[0.6rem]",
  sm: "size-5 text-[0.7rem] short:size-4 short:text-[0.6rem]",
  md: "size-8 text-sm short:size-7 short:text-xs",
  lg: "size-14 text-2xl short:size-10 short:text-lg",
  xl: "size-24 text-5xl short:size-16 short:text-3xl",
}

/** The seat theme of the game shown (`UI_THEME.seat` of its binding); the defaults outside a game's runtime. */
export function useSeatTheme(): SeatTheme {
  const seat = useOptionalBinding()?.UI_THEME?.seat
  return useMemo(() => seatTheme(seat), [seat])
}

/**
 * The avatar alone: the initial on the seat colour, or the account picture, in the shape the game picked. `children` sit on its
 * top-right corner, outside its clip (the lobby puts the host's crown there). Decorative: the nickname is always written next to it.
 */
export function SeatAvatarMark({
  avatar,
  theme,
  size = "md",
  className,
  children,
}: {
  avatar: SeatAvatar
  /** Default: the one of the game shown */
  theme?: SeatTheme
  size?: SeatSize
  className?: string
  children?: ReactNode
}) {
  const own = useSeatTheme()
  const { shape, ring, font } = theme ?? own
  return (
    <span className={cn("relative inline-flex shrink-0", SIZES[size], className)}>
      <span
        // the lobby and the game over set letter-spacing, case and a text shadow on the line the label sits in: not on the initial
        className={cn(
          "grid size-full place-items-center overflow-hidden leading-none font-black tracking-normal select-none [text-shadow:none]",
          shape === "square" ? "rounded-[24%]" : "rounded-full",
        )}
        style={{ backgroundColor: avatar.color, color: avatar.ink, fontFamily: font, boxShadow: `0 0 0 1.5px ${ring}, 0 1px 4px rgb(0 0 0 / 0.35)` }}
      >
        {avatar.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a profile picture from wherever the account stores it, decorative
          <img src={avatar.imageUrl} alt="" draggable={false} className="size-full object-cover" />
        ) : (
          <span aria-hidden>{avatar.initial}</span>
        )}
      </span>
      {children && <span className="absolute -top-1 -right-1.5 grid place-items-center">{children}</span>}
    </span>
  )
}

export type SeatLabelProps = {
  nickname: string
  /** The seat colour */
  color: string
  /** The account's picture (PLT-13); absent: the avatar is generated */
  imageUrl?: string | null
  theme?: SeatTheme
  size?: SeatSize
  /** Colour of the nickname: "seat" or "ink" (the text colour around it). Default: the theme's `name` */
  name?: SeatTheme["name"]
  /** On the avatar's top-right corner (the host's crown) */
  corner?: ReactNode
  className?: string
  avatarClassName?: string
  /** After the nickname ("you", a ✓…) */
  children?: ReactNode
}

/** Avatar then nickname on one line; the nickname truncates, what follows it does not. */
export function SeatLabel({ nickname, color, imageUrl, theme, size = "md", name, corner, className, avatarClassName, children }: SeatLabelProps) {
  const own = useSeatTheme()
  const resolved = theme ?? own
  const avatar = useMemo(() => seatAvatar({ nickname, color, imageUrl }), [nickname, color, imageUrl])
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <SeatAvatarMark avatar={avatar} theme={resolved} size={size} className={avatarClassName}>
        {corner}
      </SeatAvatarMark>
      {/* a nickname is typed by its player: session recordings show it masked (`ph-mask`) */}
      <span className="ph-mask truncate" style={(name ?? resolved.name) === "seat" ? { color } : undefined}>
        {nickname}
      </span>
      {children}
    </span>
  )
}
