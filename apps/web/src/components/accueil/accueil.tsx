"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { BoutonCour, ChampAppellation, ChampCode, Description, EcranBanquet } from "@/components/banquet/ecran-banquet"
import { api, lienPartie } from "@/lib/api"
import type { CatalogueClient } from "@/lib/catalogue"
import { useProfil } from "@/lib/profil"

export function Accueil({ catalogue }: { catalogue: CatalogueClient }) {
  const router = useRouter()
  const { profil, setProfil, valide } = useProfil(catalogue.chateaux[0]!.id)
  const [code, setCode] = useState("")
  const [enCours, setEnCours] = useState<"creer" | "rejoindre" | null>(null)

  function verifierProfil() {
    if (valide) return true
    toast.error("Choisissez d'abord votre appellation.")
    document.getElementById("pseudo")?.focus()
    return false
  }

  async function creer() {
    if (!verifierProfil()) return
    setEnCours("creer")
    try {
      const partie = await api.creer(profil)
      try {
        await navigator.clipboard.writeText(lienPartie(partie.code))
        toast.success("Lien du banquet copié !", { description: "Envoyez-le à vos amis pour qu'ils vous rejoignent." })
      } catch {
        toast.success(`Partie ${partie.code} créée !`)
      }
      router.push(`/partie/${partie.code}`)
    } catch (error) {
      toast.error((error as Error).message)
      setEnCours(null)
    }
  }

  function courtiser(event: React.FormEvent) {
    event.preventDefault()
    if (!verifierProfil()) return
    if (code.length === 0) {
      creer()
      return
    }
    if (code.length !== 6) {
      toast.error("Le code de partie fait 6 caractères.")
      return
    }
    setEnCours("rejoindre")
    router.push(`/partie/${code}`)
  }

  const occupe = enCours !== null

  return (
    <EcranBanquet
      logoUrl={catalogue.logoUrl}
      onSubmit={courtiser}
      bouton={<BoutonCour occupe={occupe}>Courtiser au banquet</BoutonCour>}
      bas={<ChampCode value={code} onChange={setCode} />}
    >
      <Description>
        Ce soir a lieu le banquet de la reine. Un évènement majeur où les familles du royaume veulent se montrer à leur avantage. Les manœuvres vont
        bon train et tous les coups sont permis pour placer son favori sur le devant de la scène.
      </Description>
      <ChampAppellation value={profil.pseudo} onChange={(pseudo) => setProfil({ pseudo })} />
    </EcranBanquet>
  )
}
