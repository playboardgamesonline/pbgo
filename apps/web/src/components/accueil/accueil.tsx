"use client"

import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { Loader2Icon } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ChateauPicker } from "@/components/chateau"
import { Logo } from "@/components/logo"
import { ReglesButton } from "@/components/regles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
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
    toast.error("Choisis d'abord ton pseudonyme.")
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
        toast.success("Lien de la partie copié !", { description: "Envoie-le à tes amis pour qu'ils te rejoignent." })
      } catch {
        toast.success(`Partie ${partie.code} créée !`)
      }
      router.push(`/partie/${partie.code}`)
    } catch (error) {
      toast.error((error as Error).message)
      setEnCours(null)
    }
  }

  function rejoindre(event: React.FormEvent) {
    event.preventDefault()
    if (!verifierProfil()) return
    if (code.length !== 6) {
      toast.error("Le code de partie fait 6 caractères.")
      return
    }
    setEnCours("rejoindre")
    router.push(`/partie/${code}`)
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16">
      <ReglesButton className="absolute top-4 right-4" />

      <motion.div
        initial={{ opacity: 0, y: -20, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
        className="w-full max-w-md"
      >
        <Logo src={catalogue.logoUrl} />
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-10 w-full max-w-md space-y-6 rounded-2xl border bg-card/80 p-6 shadow-2xl backdrop-blur"
      >
        <div className="space-y-2">
          <Label htmlFor="pseudo">Ton pseudonyme</Label>
          <Input
            id="pseudo"
            value={profil.pseudo}
            maxLength={20}
            autoComplete="nickname"
            placeholder="Dame Aliénor"
            onChange={(e) => setProfil({ pseudo: e.target.value })}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label>Ton château</Label>
          <ChateauPicker chateaux={catalogue.chateaux} value={profil.chateau} onChange={(chateau) => setProfil({ chateau })} />
        </div>

        <Button size="lg" className="h-12 w-full font-display text-base tracking-wide" onClick={creer} disabled={enCours !== null}>
          {enCours === "creer" && <Loader2Icon className="animate-spin" />}
          Créer une partie
        </Button>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou rejoindre avec un code
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={rejoindre} className="flex flex-wrap items-center justify-center gap-3">
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
            aria-label="Code de partie"
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot key={i} index={i} className="size-10 font-display text-lg uppercase" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button type="submit" variant="secondary" className="h-10" disabled={enCours !== null}>
            {enCours === "rejoindre" && <Loader2Icon className="animate-spin" />}
            Rejoindre une partie
          </Button>
        </form>
      </motion.section>
    </main>
  )
}
