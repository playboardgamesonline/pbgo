"use client"

import type { Account } from "@pbgo/accounts"
import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import type { SocialState } from "@pbgo/core/lib/friends"
import { AddFriendForm } from "@pbgo/ui/platform/add-friend-form"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import type { FriendRequest } from "@pbgo/ui/social"
import { FriendsList } from "@/components/friends-list"
import { useFriendActions } from "@/components/friend-actions"
import { useSocial } from "@/lib/use-social"

/** A request that waits for an answer: to accept or decline when it came in, to cancel when it went out. */
function Request({ request, onAnswer }: { request: FriendRequest; onAnswer: (request: FriendRequest, answer: "accept" | "decline" | "cancel") => void }) {
  return (
    <Item size="sm">
      <ItemMedia>
        <Avatar>
          {request.avatarUrl && <AvatarImage src={request.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="ph-mask">{request.nickname.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className="ph-mask">
            {request.nickname}
            <span className="text-muted-foreground">#{request.tag}</span>
          </span>
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        {request.direction === "incoming" ? (
          <>
            <Button size="sm" onClick={() => onAnswer(request, "accept")}>
              Accept
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAnswer(request, "decline")}>
              Decline
            </Button>
          </>
        ) : (
          <>
            <Badge variant="secondary">Sent</Badge>
            <Button size="sm" variant="ghost" onClick={() => onAnswer(request, "cancel")}>
              Cancel
            </Button>
          </>
        )}
      </ItemActions>
    </Item>
  )
}

/**
 * The page of the friends (`/me/friends`, PLT-23): add one by username and tag, answer the requests, and the whole list, with its search (the panel of the navbar is the short way to the games they are in). It reads the same state as the panel
 * (`useSocial`: one store, kept fresh in the browser), so that an answer given here is seen there at once; `initial` is what the page read on the server, shown until the browser has read it. The demo account of development has made-up friends, and its buttons say they are done.
 */
export function FriendsView({ accountId, initial }: { accountId: Account["id"]; initial: SocialState | null }) {
  const social = useSocial({ id: accountId }, initial)
  const actions = useFriendActions()
  const preview = accountId === DEMO_ACCOUNT.id
  const incoming = social.requests.filter((request) => request.direction === "incoming")
  const outgoing = social.requests.filter((request) => request.direction === "outgoing")

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="add-friend">
        <h2 id="add-friend" className="mb-1 font-heading text-2xl">
          Add a friend
        </h2>
        <p className="mb-4 text-muted-foreground">Type their username and their tag, like Oré#4821.</p>
        <AddFriendForm className="max-w-md" onSend={actions.sendRequest} />
      </section>

      {social.requests.length > 0 ? (
        <section aria-labelledby="requests" className="flex flex-col gap-2">
          <h2 id="requests" className="mb-2 font-heading text-2xl">
            Requests
          </h2>
          {incoming.map((request) => (
            <Request key={request.id} request={request} onAnswer={actions.answer} />
          ))}
          {outgoing.map((request) => (
            <Request key={request.id} request={request} onAnswer={actions.answer} />
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
          <FriendsList friends={social.friends} preview={preview} onViewProfile={actions.viewProfile} onRemove={actions.remove} onBlock={actions.block} />
        </div>
      </section>
      {actions.dialog}
    </div>
  )
}
