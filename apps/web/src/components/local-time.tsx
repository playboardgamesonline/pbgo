"use client"

import { useSyncExternalStore } from "react"
import type { TimeFormat } from "@pbgo/accounts"
import { cn } from "@pbgo/ui/utils"
import { perTimeFormat } from "../lib/time-format"

// A moment written in the time of the person who reads it, in their own time zone, which only their browser knows. The server and the first render in the browser write it the same way, in UTC and out of sight, so that the page they make is the same one; the browser writes it in its own
// zone as soon as it has taken the page over, and it shows. The day, the hour and the clock (12 or 24 hours) are the member's choice of the settings (`TimeFormat`), and the zone is not named: it is the reader's.

const make = (timeZone?: string) =>
  perTimeFormat(({ hourCycle }) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hourCycle, timeZone }))
const LOCAL = make()
const UTC = make("UTC")

const subscribe = () => () => {}

export function LocalTime({ iso, timeFormat = "auto", className }: { iso: string; timeFormat?: TimeFormat; className?: string }) {
  const here = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  return (
    <time dateTime={iso} className={cn(!here && "invisible", className)}>
      {(here ? LOCAL : UTC)[timeFormat].format(new Date(iso))}
    </time>
  )
}
