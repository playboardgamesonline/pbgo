import type { ReactNode } from "react"
import { SettingsFrame } from "@/components/settings-frame"

/**
 * The settings of an account, `/me/settings`, when they are the page itself: an address typed, a link of an e-mail, a reload. The window is drawn over an empty page, and its sections are the pages under it. When the member opens them from a link
 * of the site, the same pages are drawn over the page they are on instead (`app/(hub)/@modal/(.)me/settings`).
 */
export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SettingsFrame over={false}>{children}</SettingsFrame>
}
