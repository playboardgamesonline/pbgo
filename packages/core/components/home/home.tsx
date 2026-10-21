"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useApi, useBinding } from "../../lib/binding-context"
import { useProfile } from "../../lib/profile"
import { DesktopNotice } from "../desktop-only"
import { useSkin, useText } from "../skin-provider"
import { CodeField, Intro, NicknameField, Paragraph, PrimaryButton, Screen } from "./screen"

export function Home() {
  const router = useRouter()
  const api = useApi()
  const { SLUG } = useBinding()
  const t = useText()
  const { home, desktopOnly } = useSkin()
  const { profile, setProfile, valid } = useProfile()
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)

  function checkProfile() {
    if (valid) return true
    toast.error(t("chooseNickname"))
    document.getElementById("nickname")?.focus()
    return false
  }

  async function validate(event: React.FormEvent) {
    event.preventDefault()
    if (!checkProfile()) return
    if (code.length > 0 && code.length !== 6) {
      toast.error(t("codeLength"))
      return
    }
    setPending(true)
    if (code.length === 6) {
      router.push(`/${SLUG}/game/${code}`)
      return
    }
    try {
      const game = await api.create(profile)
      try {
        await navigator.clipboard.writeText(api.link(game.code))
        toast.success(t("linkCopied"), { description: t("linkCopiedHint") })
      } catch {
        toast.success(t("gameCreated", { code: game.code }))
      }
      router.push(`/${SLUG}/game/${game.code}`)
    } catch (error) {
      toast.error((error as Error).message)
      setPending(false)
    }
  }

  // under 900 px the game page is for computers only: hide the form (the notice replaces it) rather than let people create a table they cannot play
  const form = desktopOnly ? "contents max-[899px]:hidden" : "contents"

  return (
    <Screen
      onSubmit={validate}
      cta={
        <div className={form}>
          <PrimaryButton busy={pending}>{code.length === 6 ? t("joinButton") : t("createButton")}</PrimaryButton>
        </div>
      }
      below={
        <div className={form}>
          <CodeField value={code} onChange={setCode} />
        </div>
      }
    >
      {home.intro ? <Intro title={home.title}>{home.intro}</Intro> : <Paragraph>{home.tagline}</Paragraph>}
      <DesktopNotice />
      <div className={form}>
        <NicknameField value={profile.nickname} onChange={(nickname) => setProfile({ nickname })} />
      </div>
    </Screen>
  )
}
