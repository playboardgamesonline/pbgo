import type { Metadata } from "next"
import { requireAccount } from "@pbgo/accounts/server"
import { FriendsView } from "@/components/friends-view"
import { socialOf } from "@/lib/social-state"

export const metadata: Metadata = { title: "Your friends" }

/**
 * Friends: add one by nickname and tag, answer the requests, and the whole list, with its search (the bar of the navbar is the short way to the games they are in). The friends are the database's (PLT-23): the page reads them on the server so that its first
 * paint has them, and the browser keeps them fresh (`FriendsView`). The demo account of development has made-up friends, made by the browser.
 */
export default async function FriendsPage() {
  const account = await requireAccount("/me/friends")
  return <FriendsView accountId={account.id} initial={await socialOf(account)} />
}
