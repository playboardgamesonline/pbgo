"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BoutonCour, ChampAppellation, ChampCode, Description, decorBanquet, EcranBanquet } from "@/components/banquet/ecran-banquet"
import { Jeu3D } from "@/components/jeu3d/jeu3d"
import { api, lienPartie } from "@/lib/api"
import type { CatalogueClient } from "@/lib/catalogue"
import { useProfil } from "@/lib/profil"
import { usePartie } from "@/lib/use-partie"
import { BoutonLobby, ListeConvives } from "./lobby"

export function PartieClient({ code, catalogue }: { code: string; catalogue: CatalogueClient }) {
  const router = useRouter()
  const { partie, erreur, appliquer } = usePartie(code)
  const { profil, setProfil, pret, valide } = useProfil(catalogue.chateaux[0]!.id)
  const [autoJoin, setAutoJoin] = useState<"idle" | "encours" | "echec" | "manuel">("idle")
  const invite = !!partie && pret && partie.moiId === null && partie.statut === "lobby"
  if (invite && !valide && autoJoin === "idle") setAutoJoin("manuel")
  const doitAutoJoin = invite && valide && (autoJoin === "idle" || autoJoin === "encours")

  async function rejoindre() {
    try {
      appliquer(await api.rejoindre(code, profil))
      return true
    } catch (e) {
      toast.error((e as Error).message)
      return false
    }
  }

  useEffect(() => {
    if (!doitAutoJoin || autoJoin !== "idle") return
    void Promise.resolve()
      .then(() => setAutoJoin("encours"))
      .then(rejoindre)
      .then((ok) => !ok && setAutoJoin("echec"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doitAutoJoin, autoJoin])

  async function quitter() {
    if (partie?.statut === "lobby" && partie.moiId) await api.quitter(code).catch(() => null)
    router.push("/")
  }

  if (partie && partie.moiId && partie.statut !== "lobby" && partie.vue) {
    return <Jeu3D partie={partie} catalogue={catalogue} onMaj={appliquer} onQuitter={() => router.push("/")} />
  }

  const lien = lienPartie(code)
  const retour = <BoutonCour onClick={quitter}>Retour à l&apos;accueil</BoutonCour>

  if (erreur)
    return (
      <EcranBanquet {...decorBanquet(catalogue)} bouton={retour}>
        <Description>Ce banquet est introuvable. Vérifiez le code {code} ou organisez-en un nouveau.</Description>
      </EcranBanquet>
    )

  if (!partie || !pret || doitAutoJoin || (partie.statut !== "lobby" && partie.moiId))
    return (
      <EcranBanquet {...decorBanquet(catalogue)} bas={<ChampCode value={code} />}>
        <Loader2Icon className="mt-[6vh] size-8 animate-spin text-primary" />
      </EcranBanquet>
    )

  if (partie.moiId === null && partie.statut !== "lobby")
    return (
      <EcranBanquet {...decorBanquet(catalogue)} bouton={retour}>
        <Description>Ce banquet a déjà commencé.</Description>
      </EcranBanquet>
    )

  if (partie.moiId === null)
    return (
      <EcranBanquet
        {...decorBanquet(catalogue)}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valide) {
            toast.error("Choisissez d'abord votre appellation.")
            return
          }
          setAutoJoin("encours")
          if (!(await rejoindre())) setAutoJoin("echec")
        }}
        bouton={<BoutonCour occupe={autoJoin === "encours"}>Rejoindre le banquet</BoutonCour>}
        bas={<ChampCode value={code} copiable={lien} />}
      >
        <ListeConvives partie={partie} />
        <ChampAppellation value={profil.pseudo} onChange={(pseudo) => setProfil({ pseudo })} />
      </EcranBanquet>
    )

  return (
    <EcranBanquet
      {...decorBanquet(catalogue)}
      bouton={<BoutonLobby partie={partie} onMaj={appliquer} />}
      bas={<ChampCode value={code} copiable={lien} />}
    >
      <Description>Partagez le code ou le lien du banquet à vos convives.</Description>
      <ListeConvives partie={partie} />
    </EcranBanquet>
  )
}
