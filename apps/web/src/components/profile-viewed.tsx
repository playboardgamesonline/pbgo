"use client"

import { useEffect } from "react"
import type { ProfileSource } from "@pbgo/accounts"
import { trackClient } from "@pbgo/analytics/client"

/** Tells the analytics that a profile was opened (`profile_viewed`): own or not, games hidden or not, and where the link was drawn (`?from=`). No name, no tag. */
export function ProfileViewed({ own, hidden, from }: { own: boolean; hidden: boolean; from: ProfileSource | null }) {
  useEffect(() => {
    trackClient("profile_viewed", { own, hidden, from: from ?? "direct" })
  }, [own, hidden, from])
  return null
}
