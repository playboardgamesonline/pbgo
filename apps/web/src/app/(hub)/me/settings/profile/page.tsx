import type { Metadata } from "next"
import { PROVIDER_NAMES, initialsOf } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { NicknameRow } from "@/components/nickname-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = { title: "Profile settings" }

/**
 * The Profile section of the settings: what the other players see of the member, their username, which they can change (it is kept in the account under a key of ours, so a provider never writes it back) and their picture, which is the
 * provider's (or their initials). Nothing else is here: how they sign in and what they record about themselves is the Account section, and the language and the clock are the Language & time section.
 */
export default async function ProfileSettingsPage() {
  const account = await requireAccount("/me/settings/profile")
  const demo = isDemoAccount(account)
  const picture = account.avatarUrl
    ? account.provider
      ? `The picture of your ${PROVIDER_NAMES[account.provider]} account.`
      : "Your picture."
    : "The initials of your username."

  return (
    <SettingsPage title="Profile" description="What the other players see of you.">
      <SettingsGroup title="You">
        <NicknameRow nickname={account.nickname} demo={demo} />
        <Item>
          <ItemMedia>
            <Avatar className="size-10">
              {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt="" referrerPolicy="no-referrer" />}
              <AvatarFallback>{initialsOf(account.nickname)}</AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Picture</ItemTitle>
            <ItemDescription>{picture}</ItemDescription>
          </ItemContent>
        </Item>
      </SettingsGroup>
    </SettingsPage>
  )
}
