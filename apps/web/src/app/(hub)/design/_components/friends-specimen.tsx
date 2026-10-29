"use client"

import { FriendsPanel, type Friend } from "@pbgo/ui/platform/friends-panel"

const FRIENDS: readonly Friend[] = [
  { id: "1", nickname: "Marly", tag: "4821", status: "playing", activity: "Courtisans · table K7P" },
  { id: "2", nickname: "Hervé", tag: "0412", status: "playing", activity: "Skull King · table 9QD" },
  { id: "3", nickname: "Zoé", tag: "1033", status: "online", activity: "In the lobby" },
  { id: "4", nickname: "Tom", tag: "7712", status: "online" },
  { id: "5", nickname: "Lina", tag: "2290", status: "online" },
  { id: "6", nickname: "Max", tag: "5501", status: "offline", activity: "2 h ago" },
  { id: "7", nickname: "Inès", tag: "3318", status: "offline", activity: "Yesterday" },
  { id: "8", nickname: "Sam", tag: "9042", status: "offline", activity: "3 days ago" },
]

/**
 * The friends' panel with every button it can have, in a column as high as the side of a page: with friends, then with none. The buttons do nothing
 * here, and the search works.
 */
export function FriendsSpecimen({ empty = false }: { empty?: boolean }) {
  const nothing = () => {}
  return (
    <div className="h-[34rem] w-full">
      <FriendsPanel friends={empty ? [] : FRIENDS} onAddFriend={nothing} onInvite={nothing} onJoin={nothing} onShareLink={nothing} />
    </div>
  )
}
