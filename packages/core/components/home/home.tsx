"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { TAGLINE } from "@pgo/binding"
import { api, gameLink } from "../../lib/api"
import { useProfile } from "../../lib/profile"
import type { RulesContent } from "../../lib/rules"
import { useSkin, useText } from "../skin-provider"
import { CodeField, Intro, NicknameField, Paragraph, PrimaryButton, Screen } from "./screen"

export function Home({ rules }: { rules: RulesContent }) {
  const router = useRouter()
  const t = useText()
  const { home } = useSkin()
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
      router.push(`/game/${code}`)
      return
    }
    try {
      const game = await api.create(profile)
      try {
        await navigator.clipboard.writeText(gameLink(game.code))
        toast.success(t("linkCopied"), { description: t("linkCopiedHint") })
      } catch {
        toast.success(t("gameCreated", { code: game.code }))
      }
      router.push(`/game/${game.code}`)
    } catch (error) {
      toast.error((error as Error).message)
      setPending(false)
    }
  }

  return (
    <Screen
      onSubmit={validate}
      rules={rules}
      cta={<PrimaryButton busy={pending}>{code.length === 6 ? t("joinButton") : t("createButton")}</PrimaryButton>}
      below={<CodeField value={code} onChange={setCode} />}
    >
      {home.intro ? <Intro title={home.title}>{home.intro}</Intro> : <Paragraph>{TAGLINE}</Paragraph>}
      <NicknameField value={profile.nickname} onChange={(nickname) => setProfile({ nickname })} />
    </Screen>
  )
}
