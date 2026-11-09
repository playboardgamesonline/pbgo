import type { Metadata } from "next"
import { CONNECTION_PROVIDERS, EXTERNAL_PROVIDERS, PROVIDERS, PROVIDER_NAMES, countryOptions } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { enabledProviders, externalProvidersOn, requireAccount } from "@pbgo/accounts/server"
import { readBirthdate } from "@pbgo/core/server/birthdate"
import { AccountStatusRow } from "@/components/account-status-row"
import { BirthdateRow } from "@/components/birthdate-row"
import { CountryRow } from "@/components/country-row"
import { DeleteAccountRow } from "@/components/delete-account-row"
import { DevicesRow } from "@/components/devices-row"
import { EmailRow } from "@/components/email-row"
import { Connections, SignInMethods } from "@/components/linked-services"
import { MultiFactorRow } from "@/components/multi-factor-row"
import { NicknameRow } from "@/components/nickname-row"
import { PasswordRow } from "@/components/password-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = { title: "Account settings" }

/**
 * The Account section of the settings, the first one, in groups: the account's info (the username the other players see, which the member can change: it is kept in the account under a key of ours, so a provider never writes it back; and the
 * e-mail address), the password and the security (the password, multi-factor authentication, an authenticator app whose code is asked at each sign-in (PLT-129), and the devices that are signed in), the status of the account (where its warnings are told), the personal details they may record (their
 * country or region, kept on the account, and their date of birth, declared once to the server: PLT-125; both optional), the ways to sign in (Google, Discord and Steam when the project or the server has them switched on, the ones the
 * account holds shown as linked: `SignInMethods`), the connections (Twitch: linked for the profile, never a way in: `Connections`, drawn when there is one to show) and the deletion of the account. The picture is the provider's and is not
 * edited: nothing about it is on this page. The demo account of development is shown every provider, since no project is behind it to say which are on. This page is where the link of the e-mail that confirms a new address, and the way
 * back from a provider that was just linked (Supabase's, or Steam's with `?steam=` saying how it went), lead (`ACCOUNT_SETTINGS_PATH`): it is drawn per request, so it already holds the change.
 */
export default async function AccountSettingsPage({ searchParams }: { searchParams: Promise<{ steam?: string | string[] }> }) {
  const account = await requireAccount("/me/settings/account")
  const { steam } = await searchParams
  const demo = isDemoAccount(account)
  const available = demo ? [...PROVIDERS] : await enabledProviders()
  const externalAvailable = demo ? [...EXTERNAL_PROVIDERS] : externalProvidersOn()
  const showConnections = CONNECTION_PROVIDERS.some((provider) => account.linked.some((service) => service.provider === provider) || available.some((candidate) => candidate === provider))
  const hasPassword = account.linked.some((service) => service.provider === "email")
  // The date of birth is kept where only the server reads it, not in the account (PLT-125). A database that cannot say is told as no date: the row answers for itself when the member tries to declare one
  const birthdate = demo
    ? null
    : await readBirthdate(account.id).catch((error) => {
        console.error("The date of birth of a member could not be read", error)
        return null
      })

  return (
    <SettingsPage title="Account" description="Your details, how you sign in and the standing of your account.">
      <SettingsGroup title="Account info">
        <NicknameRow nickname={account.nickname} demo={demo} />
        <EmailRow email={account.email} demo={demo} />
      </SettingsGroup>
      <SettingsGroup title="Password & security">
        {/* An account that comes from Steam has no address to sign in with a password: the row appears when it has added one */}
        {account.email !== null && <PasswordRow hasPassword={hasPassword} demo={demo} />}
        {/* The second step is asked of an account that can be checked by an address if its owner loses the device: an account that comes from Steam has none, and the row is not drawn */}
        {account.email !== null && <MultiFactorRow devices={account.secondStep} demo={demo} />}
        <DevicesRow demo={demo} />
      </SettingsGroup>
      <SettingsGroup title="Account status">
        <AccountStatusRow />
      </SettingsGroup>
      <SettingsGroup title="Personal details">
        <CountryRow country={account.country} options={countryOptions()} demo={demo} />
        <BirthdateRow birthdate={birthdate} />
      </SettingsGroup>
      <SettingsGroup title="Sign-in methods">
        <SignInMethods linked={account.linked} available={available} externalAvailable={externalAvailable} demo={demo} notice={typeof steam === "string" ? steam : null} />
      </SettingsGroup>
      {showConnections && (
        <SettingsGroup title="Connections">
          <Connections linked={account.linked} available={available} demo={demo} />
        </SettingsGroup>
      )}
      <SettingsGroup title="Delete account">
        <DeleteAccountRow provider={account.email === null && account.provider ? PROVIDER_NAMES[account.provider] : null} />
      </SettingsGroup>
    </SettingsPage>
  )
}
