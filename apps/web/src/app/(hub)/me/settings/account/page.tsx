import type { Metadata } from "next"
import { PROVIDERS, PROVIDER_NAMES, countryOptions, initialsOf } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { enabledProviders, requireAccount } from "@pbgo/accounts/server"
import { readBirthdate } from "@pbgo/core/server/birthdate"
import { Avatar, AvatarFallback, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@pbgo/ui/platform/item"
import { BirthdateRow } from "@/components/birthdate-row"
import { CountryRow } from "@/components/country-row"
import { DeleteAccountRow } from "@/components/delete-account-row"
import { DevicesRow } from "@/components/devices-row"
import { EmailRow } from "@/components/email-row"
import { LinkedServices } from "@/components/linked-services"
import { NicknameRow } from "@/components/nickname-row"
import { PasswordRow } from "@/components/password-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = { title: "Account settings" }

/**
 * The Account section of the settings, the first one: who the member is for the other players (their username, which they can change: it is kept in the account under a key of ours, so a provider never writes it back; and their picture, which is the
 * provider's, or their initials), how they get in (their e-mail address and password, and the services linked to the account: the providers the project has switched on, the ones the account holds shown as linked), the personal details they
 * may record (their country or region, kept on the account, and their date of birth, declared once to the server: PLT-125; both optional), the devices that are signed in, and the deletion of the account. The demo account of development is shown all three providers, since no project is behind it to say which are on. This page is where the link of the e-mail that confirms a new address, and the
 * way back from a provider that was just linked, lead (`ACCOUNT_SETTINGS_PATH`): it is drawn per request, so it already holds the change.
 */
export default async function AccountSettingsPage() {
  const account = await requireAccount("/me/settings/account")
  const demo = isDemoAccount(account)
  const available = demo ? [...PROVIDERS] : await enabledProviders()
  const hasPassword = account.linked.some((service) => service.provider === "email")
  const picture = account.avatarUrl
    ? account.provider
      ? `The picture of your ${PROVIDER_NAMES[account.provider]} account.`
      : "Your picture."
    : "The initials of your username."
  // The date of birth is kept where only the server reads it, not in the account (PLT-125). A database that cannot say is told as no date: the row answers for itself when the member tries to declare one
  const birthdate = demo
    ? null
    : await readBirthdate(account.id).catch((error) => {
        console.error("The date of birth of a member could not be read", error)
        return null
      })

  return (
    <SettingsPage title="Account" description="Who you are, how you sign in and where you are signed in.">
      <SettingsGroup title="Profile">
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
      <SettingsGroup title="Sign-in">
        <EmailRow email={account.email} demo={demo} />
        <PasswordRow hasPassword={hasPassword} demo={demo} />
      </SettingsGroup>
      <SettingsGroup title="Personal details" description="Optional. Kept so that games for adults can be limited to adults.">
        <CountryRow country={account.country} options={countryOptions()} demo={demo} />
        <BirthdateRow birthdate={birthdate} />
      </SettingsGroup>
      <SettingsGroup title="Linked services" description="The services you can sign in with. Keep at least one.">
        <LinkedServices linked={account.linked} available={available} demo={demo} />
      </SettingsGroup>
      <SettingsGroup title="Devices">
        <DevicesRow demo={demo} />
      </SettingsGroup>
      <SettingsGroup title="Delete account">
        <DeleteAccountRow />
      </SettingsGroup>
    </SettingsPage>
  )
}
