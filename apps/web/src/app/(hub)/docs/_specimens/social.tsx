// The live specimens of the social page of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { BarListSpecimen, BarSpecimen, ChatSpecimen, DockSpecimen, FriendsSpecimen, PresenceLegend, SocialSpecimen } from "./friends-specimen"
import { Frame } from "./text"

function PresenceDotsFrame() {
  return (
    <Frame code={`<Avatar>
  <AvatarImage src={url} alt="" />
  <AvatarFallback>M</AvatarFallback>
  <PresenceDot status="playing" />
</Avatar>`}>
      <PresenceLegend />
    </Frame>
  )
}

function FriendsPanelFrame() {
  return (
    <Frame className="grid gap-6 sm:grid-cols-2" code={`<FriendsPanel
  friends={friends}
  gameIcon={(slug) => iconOf(slug)}
  onAddFriend={…}
  onInvite={(friend) => …}
  onJoin={(friend) => …}
  onShareLink={copyLink}
/>`}>
      <FriendsSpecimen />
      <FriendsSpecimen empty />
    </Frame>
  )
}

function FriendsBarFrame() {
  return (
    <Frame className="grid gap-6 sm:grid-cols-2" code={`<NavbarIsland>
  <FriendsBar
    friends={friends}
    gameIcon={(slug) => iconOf(slug)}
    onJoin={(friend) => …}
    onShareLink={copyLink}
  />
</NavbarIsland>`}>
      <BarSpecimen />
      <BarSpecimen empty />
    </Frame>
  )
}

function FriendsBarPanelFrame() {
  return (
    <Frame code={`<FriendsBarList entry={entry} onJoin={(friend) => …} />`}>
      <BarListSpecimen />
    </Frame>
  )
}

function SocialDockFrame() {
  return (
    <Frame code={`<SocialDock
  open={open}
  games={
    <>
      <FriendsBar friends={friends} … />
      <Separator orientation="vertical" />
    </>
  }
  profile={
    <AccountMenu …>
      <button>
        <Avatar …><AvatarCount count={waiting} />…</Avatar>
        <SocialDockIdentity>
          <span>{nickname}</span>
          <span>Online</span>
        </SocialDockIdentity>
      </button>
    </AccountMenu>
  }
  toggle={<SocialPanelToggle open={open} onClick={() => setOpen(!open)} />}
>
  <SocialPanel bare tab={tab} onTabChange={setTab} friends={friends} … />
</SocialDock>`}>
      <DockSpecimen />
    </Frame>
  )
}

function SocialTabsFrame() {
  return (
    <Frame className="grid gap-6 sm:grid-cols-2" code={`<SocialPanel
  header={…}
  friends={friends}
  gameIcon={(slug) => iconOf(slug)}
  conversations={conversations}
  requests={requests}
  onOpenChat={(friend) => …}
  onSendRequest={(who) => …}
  onAnswerRequest={(request, answer) => …}
  onShareLink={copyLink}
/>`}>
      <SocialSpecimen />
      <SocialSpecimen tab="messages" />
      <SocialSpecimen tab="add" />
      <SocialSpecimen empty />
    </Frame>
  )
}

function ChatWindowFrame() {
  return (
    <Frame code={`<ChatWindow
  friend={friend}
  messages={messages}
  onSend={(text) => …}
  onClose={…}
  onJoin={…}
  onRemove={…}
  onBlock={…}
  className="fixed bottom-6 right-[25rem] h-96 w-80"
/>`}>
      <ChatSpecimen />
    </Frame>
  )
}

export const socialSpecimens: Specimens = {
  "friends-panel": FriendsPanelFrame,
  "presence-dots": PresenceDotsFrame,
  "friends-bar": FriendsBarFrame,
  "friends-bar-panel": FriendsBarPanelFrame,
  "social-dock": SocialDockFrame,
  "social-tabs": SocialTabsFrame,
  "chat-window": ChatWindowFrame,
}
