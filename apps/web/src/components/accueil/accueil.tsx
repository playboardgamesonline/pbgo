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
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
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
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[#0e3940]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url(/accueil/motif.webp)] bg-[length:128px_128px] opacity-[0.07]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(34_96_104/55%),transparent_65%)]" />
      <ReglesButton icone className="absolute top-4 right-4 z-20" />

      <form onSubmit={courtiser} className="relative z-10 flex min-h-0 flex-1 flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="mt-[3vh] w-[min(18rem,60vw,28vh)] shrink-0"
        >
          <Logo src={catalogue.logoUrl} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-[2.5vh] w-full max-w-md shrink-0 space-y-2 px-4"
        >
          <Label htmlFor="pseudo" className="justify-center font-display text-base tracking-wide text-foreground/90">
            Votre appellation
          </Label>
          <Input
            id="pseudo"
            value={profil.pseudo}
            maxLength={20}
            autoComplete="nickname"
            placeholder="Dame Aliénor"
            onChange={(e) => setProfil({ pseudo: e.target.value })}
            className="h-14 border-[#8a6a3a]/60 bg-[#0b2231]/80 px-4 text-center text-xl md:text-2xl"
          />
        </motion.div>

        <div aria-hidden className="pointer-events-none relative mt-[2vh] min-h-0 w-full flex-1">
          <motion.img
            src="/accueil/reine.webp"
            alt=""
            draggable={false}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 90, damping: 16 }}
            className="absolute bottom-[min(max(5.5vw,2rem),17%)] left-1/2 h-[calc(100%-min(max(5.5vw,2rem),17%))] w-auto max-w-[80vw] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_10px_24px_rgb(0_0_0/50%)] select-none"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/accueil/objets.webp"
            alt=""
            draggable={false}
            className="absolute inset-x-0 bottom-0 h-[min(max(27.7vw,10rem),85%)] w-full object-cover object-bottom select-none"
          />
        </div>

        <div className="relative z-10 -mt-7 flex w-full shrink-0 flex-col items-center gap-3 px-4 pb-[2vh]">
          <Button
            type="submit"
            size="lg"
            disabled={occupe}
            className="h-16 w-full max-w-md rounded-xl font-display text-xl tracking-wide shadow-[0_10px_30px_rgb(0_0_0/50%),0_0_28px_rgb(242_193_78/35%)] md:text-2xl"
          >
            {occupe && <Loader2Icon className="animate-spin" />}
            Courtiser au banquet
          </Button>
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
            aria-label="Code d'un banquet à rejoindre (facultatif)"
          >
            <InputOTPGroup>
              {[0, 1, 2].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-11 bg-[#0b2231]/80 font-display text-lg uppercase" />
              ))}
            </InputOTPGroup>
            <InputOTPSeparator className="text-foreground/60" />
            <InputOTPGroup>
              {[3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-11 bg-[#0b2231]/80 font-display text-lg uppercase" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      </form>

      <footer className="relative z-20 shrink-0 bg-[#04161a] px-4 py-2 text-center text-[10px] leading-snug text-foreground/55 md:text-xs">
        Adaptation en ligne non officielle et gratuite de <em>Courtisans</em>, un jeu de Romaric Galonnier et Anthony Perone, illustré par Noëmie
        Chevalier et édité par Catch Up Games · Tous droits réservés à leurs auteurs et à l&apos;éditeur · Développé par{" "}
        <a
          href="https://ore.today"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
        >
          oré
        </a>{" "}
        · Réclamations :{" "}
        <a href="mailto:louvel.aurelien.pro@gmail.com" className="underline decoration-foreground/30 underline-offset-2 hover:text-foreground">
          louvel.aurelien.pro@gmail.com
        </a>
      </footer>
    </main>
  )
}
