import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { LANGUAGE_COOKIE, PROVIDER_NAMES, initialsOf, resolveLanguage } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { LanguageRow } from "@/components/language-row"
import { NicknameRow } from "@/components/nickname-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = { title: "Profile settings" }

/**
 * The Profile section of the settings: what the other players see of the member, their nickname, which they can change (it is kept in the account under a key of ours, so a provider never writes it back) and their picture, which is the
 * provider's (or their initials), and the language of the platform, in the order of the site: the account's, else the cookie's, else the browser's, else English.
 */
export default async function ProfileSettingsPage() {
  const account = await requireAccount("/me/settings/profile")
  const demo = isDemoAccount(account)
  const [store, requestHeaders] = await Promise.all([cookies(), headers()])
  const language = resolveLanguage({ account: account.language, cookie: store.get(LANGUAGE_COOKIE)?.value, browser: requestHeaders.get("accept-language") })
  const picture = account.avatarUrl
    ? account.provider
      ? `The picture of your ${PROVIDER_NAMES[account.provider]} account.`
      : "Your picture."
    : "The initials of your nickname."

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
      <SettingsGroup title="Preferences">
        <LanguageRow language={language} />
      </SettingsGroup>
    </SettingsPage>
  )
}
