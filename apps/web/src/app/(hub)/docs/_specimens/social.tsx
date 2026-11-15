// The live specimens of the social pages of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { BarListSpecimen, BarSpecimen, ChatSpecimen, DockSpecimen, FriendPickerSpecimen, GroupSpecimen, InvitationsSpecimen, InvitePickerSpecimen, PlayerSlotsSpecimen, PresenceLegend, SocialSpecimen } from "./friends-specimen"
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

function FriendsBarFrame() {
  return (
    <Frame className="grid gap-6 sm:grid-cols-2" code={`<FriendsBar
  friends={friends}
  gameIcon={(slug) => iconOf(slug)}
  onJoin={(friend) => …}
  onShareLink={copyLink}
/>`}>
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
  <SocialPanel bare tab={tab} onTabChange={setTab} friends={friends} group={group} … />
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
  group={group} // null for no group; left out, the panel has three tabs
  invitations={invitations}
  onInvite={(friend) => inviteToGroup(friend)}
  onJoin={(friend) => askToJoin(friend)}
  onInviteToGroup={openPicker}
  onLeaveGroup={leave}
  onKickMember={(member) => …}
  onMakeLeader={(member) => …}
  onViewMember={(member) => …}
  onAnswerInvitation={(invitation, answer) => …}
  onOpenChat={(friend) => …}
  onViewProfile={(friend) => …}
  onRemove={(friend) => …}
  onBlock={(friend) => …}
  onSendRequest={(who) => …}
  onAnswerRequest={(request, answer) => …}
  onShareLink={copyLink}
/>`}>
      <SocialSpecimen />
      <SocialSpecimen tab="group" />
      <SocialSpecimen tab="messages" />
      <SocialSpecimen tab="add" />
      <SocialSpecimen empty />
      <SocialSpecimen tab="group" empty />
    </Frame>
  )
}

function GroupPaneFrame() {
  return (
    <Frame className="grid gap-6 sm:grid-cols-2" code={`<GroupPane
  group={group} // { members, max }, or null for no group
  onInvite={openPicker}
  onLeave={leave}
  onKick={(member) => confirmRemoval(member)}
  onMakeLeader={(member) => handOver(member)}
  onViewProfile={(member) => openProfile(member)}
/>`}>
      <GroupSpecimen state="leader" />
      <GroupSpecimen state="member" />
      <GroupSpecimen state="full" />
      <GroupSpecimen state="none" />
    </Frame>
  )
}

function InvitationsCardFrame() {
  return (
    <Frame code={`<InvitationsCard
  invitations={invitations} // { kind: "table" | "group" | "join", … }
  gameIcon={(slug) => iconOf(slug)}
  onAnswer={(invitation, answer) => …}
/>`}>
      <InvitationsSpecimen />
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

function InvitePickerFrame() {
  return (
    <Frame code={`<InviteFriendDialog
  open={open}
  onOpenChange={setOpen}
  friends={friends}
  onInvite={async (friend) => sendInvitation(friend)}
  // for a group: what the window is called, and what it says
  title="Invite a friend to your group"
  description="One press sends the invitation to your group."
/>`}>
      <InvitePickerSpecimen />
    </Frame>
  )
}

function FriendPickerFrame() {
  return (
    <Frame code={`<Popover>
  <PopoverTrigger asChild>…a free place…</PopoverTrigger>
  <PopoverContent className="rounded-2xl p-3">
    <FriendPicker
      friends={friends}
      limit={8}
      onInvite={async (friend) => sendInvitation(friend)}
      // a way to bring somebody who is not a friend yet
      link={{ onCopy: copy, copied }}
      // for a table that does not exist yet: "Add" and "Added" in place of "Invite" and "Invited"
      labels={{ action: "Add", done: "Added" }}
    />
  </PopoverContent>
</Popover>`}>
      <FriendPickerSpecimen />
    </Frame>
  )
}

function PlayerSlotsFrame() {
  return (
    <Frame code={`<PlayerSlots
  // the visitor first: they have the middle place, the others fill outwards from it
  players={[{ id: "me", name: "Oré", you: true }, { id: "1", name: "Marly", leader: true, status: "playing" }]}
  // how many places the row has, from 1 to nine; it is never fewer than the people in it
  size={9}
  // what a free place opens
  picker={<FriendPicker friends={friends} onInvite={invite} />}
  // what a press on a person opens
  menu={(player) => (player.you ? null : <DropdownMenuItem>View profile</DropdownMenuItem>)}
/>`}>
      <div className="flex flex-col gap-10">
        <PlayerSlotsSpecimen />
        <PlayerSlotsSpecimen size={4} alone />
      </div>
    </Frame>
  )
}

export const socialSpecimens: Specimens = {
  "presence-dots": PresenceDotsFrame,
  "friends-bar": FriendsBarFrame,
  "friends-bar-panel": FriendsBarPanelFrame,
  "social-dock": SocialDockFrame,
  "social-tabs": SocialTabsFrame,
  "group-pane": GroupPaneFrame,
  "invitations-card": InvitationsCardFrame,
  "chat-window": ChatWindowFrame,
  "invite-friend": InvitePickerFrame,
  "friend-picker": FriendPickerFrame,
  "player-slots": PlayerSlotsFrame,
}
