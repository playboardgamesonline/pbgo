"use client"

import { ArrowLeftIcon, Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { ReglesButton } from "@/components/regles"
import { Jeu } from "@/components/jeu/jeu"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { CatalogueClient } from "@/lib/catalogue"
import { useProfil } from "@/lib/profil"
import { usePartie } from "@/lib/use-partie"
import { Lobby } from "./lobby"
import { RejoindreFormulaire } from "./rejoindre"

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
    return <Jeu partie={partie} catalogue={catalogue} onMaj={appliquer} onQuitter={() => router.push("/")} />
  }

  let contenu: React.ReactNode
  if (erreur) {
    contenu = (
      <div className="space-y-4 text-center">
        <p className="font-display text-2xl">Partie introuvable</p>
        <p className="text-muted-foreground">Vérifie le code {code} ou crée une nouvelle partie.</p>
        <Button asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    )
  } else if (!partie || !pret || doitAutoJoin) {
    contenu = <Loader2Icon className="size-8 animate-spin text-primary" />
  } else if (partie.moiId === null) {
    contenu =
      partie.statut === "lobby" ? (
        <RejoindreFormulaire code={partie.code} chateaux={catalogue.chateaux} profil={profil} setProfil={setProfil} onRejoindre={async () => void (await rejoindre())} />
      ) : (
        <div className="space-y-4 text-center">
          <p className="font-display text-2xl">Partie déjà commencée</p>
          <Button asChild>
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      )
  } else if (partie.statut === "lobby") {
    contenu = <Lobby partie={partie} chateaux={catalogue.chateaux} onMaj={appliquer} />
  } else {
    contenu = <p className="font-display text-2xl">La partie commence…</p>
  }

  return (
    <main className="relative flex flex-1 flex-col items-center px-4 pt-4 pb-12">
      <header className="flex w-full items-center justify-between gap-4">
        <Button variant="ghost" onClick={quitter}>
          <ArrowLeftIcon />
          Quitter
        </Button>
        <ReglesButton />
      </header>
      <Logo src={catalogue.logoUrl} className="mt-2 max-w-64" />
      <div className="flex w-full flex-1 flex-col items-center justify-center py-8">{contenu}</div>
    </main>
  )
}
