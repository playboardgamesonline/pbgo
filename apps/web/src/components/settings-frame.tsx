import type { ReactNode } from "react"
import { requireAccount } from "@pbgo/accounts/server"
import { SettingsModal } from "@/components/settings-modal"
import { ownProfileHead } from "@/lib/profile-data"

/** The settings window for the signed-in member. The page (`/me/settings/**`) and the window over a page (`@modal`) draw it the same way. Its head says the name with its tag (PLT-39). */
export async function SettingsFrame({ over, children }: { over: boolean; children: ReactNode }) {
  const account = await requireAccount("/me/settings/account")
  const head = await ownProfileHead(account)
  return (
    <SettingsModal nickname={head.nickname} tag={head.tag} avatarUrl={head.avatarUrl ?? account.avatarUrl ?? null} over={over}>
      {children}
    </SettingsModal>
  )
}
