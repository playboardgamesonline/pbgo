// The live specimens of the social pages of the design docs (`docs/design`): one component for each piece the markdown shows, registered by name below. The words around them are the page's.

import type { Specimens } from "@pbgo/docs/markdown"
import { BarListSpecimen, BarSpecimen, ChatSpecimen, DockSpecimen, GroupSpecimen, InvitationsSpecimen, InvitePickerSpecimen, PresenceLegend, SocialSpecimen } from "./friends-specimen"
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
}
