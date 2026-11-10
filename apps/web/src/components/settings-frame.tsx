import type { ReactNode } from "react"
import { requireAccount } from "@pbgo/accounts/server"
import { SettingsModal } from "@/components/settings-modal"

/** The settings window with the member it is for: the page itself (`/me/settings/**`) and the window over a page (`@modal`) draw it the same way, and each asks who is signed in, since the second is not under `/me`'s layout. */
export async function SettingsFrame({ over, children }: { over: boolean; children: ReactNode }) {
  const account = await requireAccount("/me/settings/account")
  return (
    <SettingsModal nickname={account.nickname} avatarUrl={account.avatarUrl ?? null} over={over}>
      {children}
    </SettingsModal>
  )
}
