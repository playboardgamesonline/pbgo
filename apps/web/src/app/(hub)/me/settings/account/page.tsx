import type { Metadata } from "next"
import { PROVIDERS } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { enabledProviders, requireAccount } from "@pbgo/accounts/server"
import { mailAvailable } from "@pbgo/core/server/mail"
import { DeleteAccountRow } from "@/components/delete-account-row"
import { DevicesRow } from "@/components/devices-row"
import { EmailRow } from "@/components/email-row"
import { LinkedServices } from "@/components/linked-services"
import { PasswordRow } from "@/components/password-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = { title: "Account settings" }

/**
 * The Account section of the settings: how the member gets in (their e-mail address and password, and the services linked to the account: the providers the project has switched on, the ones the account holds shown as linked), the devices that
 * are signed in, and the deletion of the account (an e-mail with a link confirms it: `DeleteAccountRow`). The demo account of development is shown all three providers, since no project is behind it to say which are on. This page is where the link of the e-mail that confirms a new address, and the
 * way back from a provider that was just linked, lead (`ACCOUNT_SETTINGS_PATH`): it is drawn per request, so it already holds the change.
 */
export default async function AccountSettingsPage() {
  const account = await requireAccount("/me/settings/account")
  const demo = isDemoAccount(account)
  const available = demo ? [...PROVIDERS] : await enabledProviders()
  const hasPassword = account.linked.some((service) => service.provider === "email")

  return (
    <SettingsPage title="Account" description="How you sign in, and where you are signed in.">
      <SettingsGroup title="Sign-in">
        <EmailRow email={account.email} demo={demo} />
        <PasswordRow hasPassword={hasPassword} demo={demo} />
      </SettingsGroup>
      <SettingsGroup title="Linked services" description="The services you can sign in with. Keep at least one.">
        <LinkedServices linked={account.linked} available={available} demo={demo} />
      </SettingsGroup>
      <SettingsGroup title="Devices">
        <DevicesRow demo={demo} />
      </SettingsGroup>
      <SettingsGroup title="Delete account">
        <DeleteAccountRow email={account.email} demo={demo} available={mailAvailable()} />
      </SettingsGroup>
    </SettingsPage>
  )
}
