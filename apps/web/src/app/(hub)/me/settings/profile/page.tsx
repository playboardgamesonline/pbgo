import { redirect } from "next/navigation"

/** The Profile section is gone: its username and its picture are the first group of the Account section, and the old address (a link, a bookmark) leads there. */
export default function ProfileSettingsPage() {
  redirect("/me/settings/account")
}
