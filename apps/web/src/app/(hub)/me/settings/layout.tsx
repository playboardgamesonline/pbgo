import type { ReactNode } from "react"
import { SettingsNav } from "@/components/settings-nav"

/**
 * The settings of an account, `/me/settings`: the sections in a column at the left (a row that scrolls above the page on a phone) and the section at its right, in a column that does not stretch, under the account's header and its
 * tabs (`../layout.tsx`, which also asks who is signed in). Each section is a page of its own.
 */
export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-8 md:flex-row md:gap-12">
      <SettingsNav className="md:w-52 md:shrink-0" />
      <div className="min-w-0 flex-1 md:max-w-2xl">{children}</div>
    </div>
  )
}
