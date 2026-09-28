"use client"

import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { CheckIcon, CopyIcon, Loader2Icon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { ReglesButton } from "@/components/regles"
import { BoutonSon } from "@/components/son"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import type { CatalogueClient } from "@/lib/catalogue"
import { cn } from "@/lib/utils"

export function decorBanquet(catalogue: CatalogueClient) {
  return { logoUrl: catalogue.logoUrl, banquetHautUrl: catalogue.banquetHautUrl, banquetBasUrl: catalogue.banquetBasUrl }
}

export function EcranBanquet({
  logoUrl,
  banquetHautUrl = null,
  banquetBasUrl = "/accueil/banquet.webp",
  children,
  bouton,
  bas,
  onSubmit,
}: {
  logoUrl: string
  banquetHautUrl?: string | null
  banquetBasUrl?: string
  children?: React.ReactNode
  bouton?: React.ReactNode
  bas?: React.ReactNode
  onSubmit?: (e: React.FormEvent) => void
}) {
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[#0e3940] [--table:calc(114vw*525/3543)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url(/accueil/motif.webp)] bg-[length:128px_128px] opacity-[0.07]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(34_96_104/55%),transparent_65%)]" />
      {banquetHautUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banquetHautUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute top-0 left-[-7%] w-[114%] max-w-none select-none"
        />
      )}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
        <BoutonSon />
        <ReglesButton icone />
      </div>

      <form onSubmit={onSubmit ?? ((e) => e.preventDefault())} className="relative z-10 flex min-h-0 flex-1 flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="mt-[6vh] w-[min(18rem,60vw,26vh)] shrink-0"
        >
          <Link href="/" aria-label="Accueil">
            <Logo src={logoUrl} />
          </Link>
        </motion.div>

        {children}

        <div className="relative mt-[2vh] min-h-0 w-full flex-1">
          <motion.img
            src="/accueil/reine.webp"
            alt=""
            aria-hidden
            draggable={false}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 90, damping: 16 }}
            className="pointer-events-none absolute bottom-[calc(var(--table)*0.18)] left-1/2 h-[min(calc(100%-var(--table)*0.18),34vh)] w-auto -translate-x-1/2 object-contain object-bottom drop-shadow-[0_10px_24px_rgb(0_0_0/50%)] select-none"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banquetBasUrl}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute -bottom-2 left-[-7%] h-auto w-[114%] max-w-none select-none"
          />
          <div className="absolute inset-x-0 bottom-[calc(var(--table)*0.1)] flex flex-col items-center gap-3 px-4">
            {bouton}
            {bas}
          </div>
        </div>
      </form>

      <PiedDePage />
    </main>
  )
}

export function BoutonCour({
  children,
  occupe,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode
  occupe?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <Button
      type={onClick ? "button" : "submit"}
      size="lg"
      disabled={disabled || occupe}
      onClick={onClick}
      className={cn(
        "h-16 w-full max-w-md cursor-pointer rounded-xl bg-foreground font-display text-2xl tracking-wide text-[#0b2231] shadow-[0_10px_30px_rgb(0_0_0/55%),0_0_28px_rgb(240_233_206/30%)] transition-transform duration-200 hover:scale-[1.04] hover:bg-foreground active:scale-[0.98] disabled:cursor-default disabled:opacity-80 disabled:hover:scale-100",
        className,
      )}
    >
      {occupe && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  )
}

const CASE = "size-11 bg-[#0b2231]/80 font-display text-lg uppercase"

export function ChampCode({ value, onChange, copiable }: { value: string; onChange?: (v: string) => void; copiable?: string }) {
  const [copie, setCopie] = useState(false)
  async function copier() {
    if (!copiable) return
    try {
      await navigator.clipboard.writeText(copiable)
      setCopie(true)
      toast.success("Lien du banquet copié !")
      setTimeout(() => setCopie(false), 1600)
    } catch {
      toast.error("Impossible de copier")
    }
  }
  return (
    <div className="relative flex items-center">
      <InputOTP
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        value={value}
        onChange={(v) => onChange?.(v.toUpperCase())}
        disabled={!onChange}
        aria-label="Code du banquet"
      >
        <InputOTPGroup>
          {[0, 1, 2].map((i) => (
            <InputOTPSlot key={i} index={i} className={cn(CASE, !onChange && "opacity-100")} />
          ))}
        </InputOTPGroup>
        <InputOTPSeparator className="text-foreground/60" />
        <InputOTPGroup>
          {[3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} className={cn(CASE, !onChange && "opacity-100")} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {copiable && (
        <button
          type="button"
          onClick={copier}
          aria-label="Copier le lien du banquet"
          title="Copier le lien du banquet"
          className="absolute -right-14 flex size-11 cursor-pointer items-center justify-center rounded-lg border border-foreground/50 bg-[#0b2231]/80 text-foreground transition-transform hover:scale-110"
        >
          {copie ? <CheckIcon className="size-5" /> : <CopyIcon className="size-5" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  )
}

export function ChampAppellation({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-[4.5vh] w-full max-w-md shrink-0 px-4"
    >
      <Input
        id="pseudo"
        value={value}
        maxLength={20}
        autoComplete="nickname"
        placeholder="VOTRE APPELLATION"
        aria-label="Votre appellation"
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-14 border-[#8a6a3a]/60 bg-[#0b2231]/80 px-4 text-center font-display text-xl tracking-[0.12em] uppercase placeholder:text-foreground/30 md:text-2xl"
      />
    </motion.div>
  )
}

export function Description({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="mt-[2.5vh] max-w-2xl shrink-0 px-4 text-center text-lg leading-snug text-balance text-foreground/85 [text-shadow:0_1px_6px_rgb(0_0_0/60%)]"
    >
      {children}
    </motion.p>
  )
}

function PiedDePage() {
  const lien = "underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
  return (
    <footer className="relative z-20 shrink-0 bg-[#031622] px-4 pt-[4vh] pb-[3vh] text-center text-xs leading-relaxed text-foreground/55">
      <p>
        Adaptation en ligne non officielle et gratuite de <em>Courtisans</em>, un jeu de Romaric Galonnier et Anthony Perone, illustré par Noëmie
        Chevalier et édité par{" "}
        <a href="https://catchupgames.com/nos-jeux/courtisans/" target="_blank" rel="noreferrer" className={lien}>
          Catch Up Games
        </a>
        . Tous droits réservés à leurs auteurs et à l&apos;éditeur.
      </p>
      <p>
        Développé par{" "}
        <a href="https://ore.today" target="_blank" rel="noreferrer" className={lien}>
          oré
        </a>{" "}
        · Pour toute réclamation :{" "}
        <a href="mailto:louvel.aurelien.pro@gmail.com" className={lien}>
          louvel.aurelien.pro@gmail.com
        </a>
      </p>
    </footer>
  )
}
