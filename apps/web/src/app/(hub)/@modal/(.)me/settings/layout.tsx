import type { ReactNode } from "react"
import { SettingsFrame } from "@/components/settings-frame"

/** The settings drawn over the page the member is on, when a link of the site leads to `/me/settings/**`: the same window as the page's own (`app/(hub)/me/settings/layout.tsx`), with the page left under it. */
export default function SettingsOverlayLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SettingsFrame over>{children}</SettingsFrame>
}
