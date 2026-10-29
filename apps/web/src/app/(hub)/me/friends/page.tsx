import type { Metadata } from "next"
import { requireAccount } from "@pbgo/accounts/server"
import { AddFriendForm } from "@pbgo/ui/platform/add-friend-form"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { FriendsList } from "@/components/friends-list"
import { accountData, type FriendRequest } from "@/lib/account-data"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"

export const metadata: Metadata = { title: "Your friends" }

/** A request that waits for an answer: to accept or decline when it came in, to cancel when it went out. */
function Request({ request }: { request: FriendRequest }) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia>
        <Avatar>
          {request.avatarUrl && <AvatarImage src={request.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback>{request.nickname.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span>
            {request.nickname}
            <span className="text-muted-foreground">#{request.tag}</span>
          </span>
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        {request.direction === "incoming" ? (
          <>
            <Button size="sm">Accept</Button>
            <Button size="sm" variant="ghost">
              Decline
            </Button>
          </>
        ) : (
          <>
            <Badge variant="secondary">Sent</Badge>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </>
        )}
      </ItemActions>
    </Item>
  )
}

/**
 * Friends: add one by nickname and tag, answer the requests, and the whole list, with its search (the bar of the navbar is the short way to the games they are
 * in). Nobody has friends yet for a real account (PLT-23): it says so, and the field does nothing until friends exist.
 */
export default async function FriendsPage() {
  const account = await requireAccount("/me/friends")
  const { friends, requests } = accountData(account)
  const preview = account.id === DEMO_ACCOUNT.id
  const incoming = requests.filter((request) => request.direction === "incoming")
  const outgoing = requests.filter((request) => request.direction === "outgoing")

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="add-friend">
        <h2 id="add-friend" className="mb-1 font-heading text-2xl">
          Add a friend
        </h2>
        <p className="mb-4 text-muted-foreground">Type their username and their tag, like Oré#4821.</p>
        <AddFriendForm className="max-w-md" />
      </section>

      {requests.length > 0 ? (
        <section aria-labelledby="requests" className="flex flex-col gap-2">
          <h2 id="requests" className="mb-2 font-heading text-2xl">
            Requests
          </h2>
          {incoming.map((request) => (
            <Request key={request.id} request={request} />
          ))}
          {outgoing.map((request) => (
            <Request key={request.id} request={request} />
          ))}
        </section>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No request</EmptyTitle>
            <EmptyDescription>The friend requests you send and receive wait here for an answer.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <section aria-label="Your friends">
        <div className="h-[32rem]">
          <FriendsList friends={friends} preview={preview} />
        </div>
      </section>
    </div>
  )
}
