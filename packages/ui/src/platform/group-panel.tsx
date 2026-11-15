"use client"

import * as React from "react"
import { CrownIcon, Logout01Icon, MoreHorizontalIcon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials, statusLine } from "../friends"
import { isFull, orderedMembers, sizeLine, youLead, type Group, type GroupMember } from "../groups"
import { cn } from "../utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu"
import { PresenceDot } from "./friends-panel"

// The group of a signed-in visitor (PLT-23), the pane of the group tab of the social panel: its members, the leader first, each as a friend is drawn in the roster (their picture with the dot of their presence, their name with its tag, and what they are doing), with a
// crown on the one who leads and "(you)" on the visitor; the way to bring a friend in, and the way out. The leader's menu on a member hands the lead over or removes them; every member can open a member's profile. A group has two to eight members: with all of them the
// button that invites says the group is full instead. With no group the pane says so and offers the one thing that makes one, inviting a friend (a group is made when the friend accepts). It is drawn from the group it is given and decides nothing: where it comes
// from (the server's state) and what a button does are the page's, and a button whose handler is missing is not drawn, nor a menu with nothing in it.

/** A scrolling column with no scrollbar, for the members. */
const COLUMN = "min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

type MemberHandlers = {
  /** What "Remove from group" does, in the menu of a member, when the visitor leads. Not drawn without it. */
  onKick?: (member: GroupMember) => void
  /** What "Make leader" does, in the menu of a member, when the visitor leads. Not drawn without it. */
  onMakeLeader?: (member: GroupMember) => void
  /** What "View profile" does, in the menu of a member who is not the visitor. Not drawn without it. */
  onViewProfile?: (member: GroupMember) => void
}

/** The button of a row that opens the menu of a member, and the menu: their profile and, for the leader, handing the lead over and removing them. The visitor has none on their own row (they leave with the button at the foot), and a row with nothing to offer has no button. */
function MemberMenu({ member, leads, onKick, onMakeLeader, onViewProfile }: { member: GroupMember; leads: boolean } & MemberHandlers) {
  if (member.you) return null
  const lead = leads ? onMakeLeader : undefined
  const kick = leads ? onKick : undefined
  if (!onViewProfile && !lead && !kick) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`More about ${member.nickname}`}
          title="More"
          className="shrink-0 opacity-0 group-hover/member:opacity-100 focus-visible:opacity-100 group-focus-within/member:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {onViewProfile && <DropdownMenuItem onSelect={() => onViewProfile(member)}>View profile</DropdownMenuItem>}
        {lead && <DropdownMenuItem onSelect={() => lead(member)}>Make leader</DropdownMenuItem>}
        {kick && (onViewProfile || lead) && <DropdownMenuSeparator />}
        {kick && (
          <DropdownMenuItem variant="destructive" onSelect={() => kick(member)}>
            Remove from group
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A member of the group: the picture and the dot of their presence, their name with its tag (masked in a recording), "(you)" for the visitor and the crown, with a word for a screen reader, for the leader; under it what they are doing. */
function MemberRow({ member, leads, ...handlers }: { member: GroupMember; leads: boolean } & MemberHandlers) {
  return (
    <li
      data-slot="group-member"
      data-status={member.status}
      data-leader={member.leader ? "" : undefined}
      className="group/member flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors duration-fast hover:bg-muted/50 focus-within:bg-muted/50"
    >
      <Avatar>
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{initials(member.nickname)}</AvatarFallback>
        <PresenceDot status={member.status} />
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <p className="ph-mask truncate">
            {member.nickname}
            {member.tag && <span className="text-muted-foreground">#{member.tag}</span>}
          </p>
          {member.you && <span className="shrink-0 text-muted-foreground">(you)</span>}
          {member.leader && (
            <>
              <HugeiconsIcon icon={CrownIcon} strokeWidth={2} aria-hidden="true" className="size-4 shrink-0" />
              <span className="sr-only">Leader</span>
            </>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{statusLine(member)}</p>
      </div>
      <MemberMenu member={member} leads={leads} {...handlers} />
    </li>
  )
}

type GroupPaneProps = Omit<React.ComponentProps<"div">, "children"> &
  MemberHandlers & {
    /** The visitor's group, or null when they are in none. */
    group: Group | null
    /** What "Invite a friend" does: open the picker of the friend to invite to the group. Not drawn without it; a full group says it is full in its place. */
    onInvite?: () => void
    /** What "Leave group" does. Not drawn without it, nor without a group. */
    onLeave?: () => void
  }

/**
 * The pane of the group tab: "Your group" with how many are in it out of how many it takes, the members (`orderedMembers`, the leader first), then the buttons at the foot, the one that invites a friend and the one that leaves. With no group, an empty state and the
 * button that invites a friend. It fills the place the panel gives it and scrolls its members, without a scrollbar.
 */
function GroupPane({ group, onInvite, onLeave, onKick, onMakeLeader, onViewProfile, className, ...props }: GroupPaneProps) {
  const heading = React.useId()
  const leads = group ? youLead(group) : false
  const invite =
    onInvite &&
    (group && isFull(group) ? (
      <p data-slot="group-full" className="px-2.5 py-2 text-center text-sm text-muted-foreground">
        The group is full
      </p>
    ) : (
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={onInvite}>
        <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} data-icon="inline-start" />
        Invite a friend
      </Button>
    ))
  const leave = group && onLeave && (
    <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onLeave}>
      <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} data-icon="inline-start" />
      Leave group
    </Button>
  )

  return (
    <div data-slot="group-pane" className={cn("flex min-h-0 flex-1 flex-col gap-4", className)} {...props}>
      {group ? (
        <section aria-labelledby={heading} className="flex min-h-0 flex-1 flex-col gap-1">
          <h3 id={heading} className="flex items-baseline gap-2 px-2.5 pb-1 text-sm text-foreground">
            Your group
            <span className="text-muted-foreground tabular-nums">{sizeLine(group)}</span>
          </h3>
          <ul className={cn(COLUMN, "flex flex-col")}>
            {orderedMembers(group).map((member) => (
              <MemberRow key={member.id} member={member} leads={leads} onKick={onKick} onMakeLeader={onMakeLeader} onViewProfile={onViewProfile} />
            ))}
          </ul>
        </section>
      ) : (
        <div data-slot="group-empty" className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-10 text-center">
          <p className="text-sm text-foreground">No group</p>
          <p className="text-sm text-muted-foreground">Invite a friend to play together. A group needs two players.</p>
        </div>
      )}

      {(invite || leave) && (
        <div className="flex flex-col gap-2">
          {invite}
          {leave}
        </div>
      )}
    </div>
  )
}

export { GroupPane }
export type { GroupPaneProps }
