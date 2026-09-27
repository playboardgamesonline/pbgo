"use client"

import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { Loader2Icon } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
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
    <main className="relative flex flex-1 flex-col overflow-hidden bg-[#0e3940]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url(/accueil/motif.webp)] bg-[length:128px_128px] opacity-[0.07]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgb(34_96_104/55%),transparent_65%),radial-gradient(ellipse_at_50%_120%,rgb(3_18_22/90%),transparent_60%)]"
      />
      <ReglesButton icone className="absolute top-5 right-5 z-20" />

      <div className="relative z-10 flex flex-1 flex-col items-center px-4 pt-12 pb-6 md:pt-16">
        <motion.div
          initial={{ opacity: 0, y: -20, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="w-full max-w-sm"
        >
          <Logo src={catalogue.logoUrl} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-5 max-w-lg text-center text-lg leading-snug text-foreground/85 [text-shadow:0_1px_6px_rgb(0_0_0/60%)] md:text-xl"
        >
          Au banquet de la Reine, chaque courtisan compte. Placez vos alliés dans la lumière, précipitez vos rivaux dans la disgrâce et accomplissez
          vos missions secrètes pour devenir le favori de la cour.
        </motion.p>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 w-full max-w-md space-y-6 rounded-2xl border border-[#8a6a3a]/40 bg-[#0b2231]/85 p-6 shadow-2xl backdrop-blur"
        >
          <div className="space-y-2">
            <Label htmlFor="pseudo" className="font-display text-base tracking-wide text-foreground/90">
              Votre appellation
            </Label>
            <Input
              id="pseudo"
              value={profil.pseudo}
              maxLength={20}
              autoComplete="nickname"
              placeholder="Dame Aliénor"
              onChange={(e) => setProfil({ pseudo: e.target.value })}
              className="h-14 border-[#8a6a3a]/50 bg-black/20 px-4 text-xl md:text-xl"
            />
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
      </div>

      <Banquet />

      <footer className="relative z-20 bg-[#04161a] px-6 py-5 text-center text-xs leading-relaxed text-foreground/60">
        <p>
          Adaptation en ligne non officielle et gratuite de <em>Courtisans</em>, un jeu de Romaric Galonnier et Anthony Perone, illustré par Noëmie
          Chevalier et édité par Catch Up Games. Tous les droits sur le jeu, ses règles et ses illustrations appartiennent à leurs auteurs et à
          l&apos;éditeur.
        </p>
        <p className="mt-1">
          Développé par{" "}
          <a
            href="https://ore.today"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
          >
            oré
          </a>{" "}
          · Pour toute réclamation :{" "}
          <a href="mailto:louvel.aurelien.pro@gmail.com" className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground">
            louvel.aurelien.pro@gmail.com
          </a>
        </p>
      </footer>
    </main>
  )
}

const CONVIVES = [
  { nom: "papillon", hauteur: 0.82, decalage: 0 },
  { nom: "crapaud", hauteur: 0.8, decalage: 0.02 },
  { nom: "rossignol", hauteur: 0.84, decalage: 0 },
  { nom: "reine", hauteur: 0.9, decalage: -0.04 },
  { nom: "lievre", hauteur: 0.8, decalage: 0.02 },
  { nom: "cerf", hauteur: 0.84, decalage: 0 },
  { nom: "carpe", hauteur: 0.86, decalage: 0.03 },
]

function Banquet() {
  return (
    <div aria-hidden className="pointer-events-none relative z-0 -mt-[4vw] mt-auto">
      <div className="relative mx-auto w-full max-w-[1600px]" style={{ aspectRatio: "3543 / 982" }}>
        <div className="absolute inset-x-[4%] top-[4%] bottom-[30%] flex items-end justify-between">
          {CONVIVES.map((c, i) => (
            <motion.img
              key={c.nom}
              src={`/accueil/${c.nom}.webp`}
              alt=""
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08, type: "spring", stiffness: 90, damping: 16 }}
              className="w-auto select-none object-contain object-bottom drop-shadow-[0_8px_16px_rgb(0_0_0/45%)]"
              style={{ height: `${c.hauteur * 100}%`, marginBottom: `${c.decalage * 100}%` }}
              draggable={false}
            />
          ))}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/accueil/objets.webp" alt="" className="absolute inset-0 size-full select-none" draggable={false} />
      </div>
    </div>
  )
}
