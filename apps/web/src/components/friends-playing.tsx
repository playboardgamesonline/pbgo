"use client"

import type { Account } from "@pbgo/accounts"
import { gamesOf } from "@pbgo/ui/friends"
import { Metric } from "@pbgo/ui/platform/metric"
import { useSocial } from "@/lib/use-social"

// The friends of the signed-in visitor who are in a game, as a figure of the head of its page (`GameLiveStats`): the ones playing it and the ones waiting in its lobby, which is the number that the pill of the game says in the navbar's dock (`gamesOf`).
// The friends are in the browser, with the social panel's (`useSocial`: the page is rendered before they are known), so the figure is 0 until they come, and for an account that has none. Both read the same hook: when the friends come from the platform
// schema (PLT-23) they will be shared through one provider instead of being asked for twice.

export function FriendsPlaying({ slug, account }: { slug: string; account: Account }) {
  const { friends } = useSocial(account)
  const count = gamesOf(friends).find(({ game }) => game.slug === slug)?.count ?? 0
  return <Metric label="Friends playing" value={count} />
}
