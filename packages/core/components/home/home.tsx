"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { RulesButton } from "../rules"
import { api, gameLink } from "../../lib/api"
import { useProfile } from "../../lib/profile"
import { TAGLINE } from "@pgo/binding"
import type { RulesContent } from "../../lib/rules"
import { PrimaryButton, CodeField, NicknameField, Screen, Paragraph } from "./screen"

export function Home({ rules }: { rules: RulesContent }) {
  const router = useRouter()
  const { profile, setProfile, valid } = useProfile()
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)

  function checkProfile() {
    if (valid) return true
    toast.error("Choisissez d'abord votre pseudo.")
    document.getElementById("nickname")?.focus()
    return false
  }

  async function validate(event: React.FormEvent) {
    event.preventDefault()
    if (!checkProfile()) return
    if (code.length > 0 && code.length !== 6) {
      toast.error("Le code de partie fait 6 caractères.")
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
        toast.success("Lien de la partie copié !", { description: "Envoyez-le à vos amis pour qu'ils vous rejoignent." })
      } catch {
        toast.success(`Partie ${game.code} créée !`)
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
      above={<RulesButton rules={rules} />}
      cta={<PrimaryButton busy={pending}>{code.length === 6 ? "Rejoindre la partie" : "Créer une partie"}</PrimaryButton>}
      below={<CodeField value={code} onChange={setCode} />}
    >
      <Paragraph>{TAGLINE}</Paragraph>
      <NicknameField value={profile.nickname} onChange={(nickname) => setProfile({ nickname })} />
    </Screen>
  )
}
