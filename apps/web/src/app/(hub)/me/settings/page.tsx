import { redirect } from "next/navigation"

/** `/me/settings` has no page of its own: it opens on its first section. */
export default function SettingsPage() {
  redirect("/me/settings/profile")
}
