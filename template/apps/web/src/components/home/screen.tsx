"use client"

import { CheckIcon, CopyIcon, Loader2Icon } from "lucide-react"
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { motion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@pgo/ui/game/input-otp"
import { useSiteSettings } from "@/components/settings-provider"
import { AUTHOR, CONTACT } from "@/lib/site"
import { cn } from "@/lib/utils"

export function Screen({
  children,
  cta,
  below,
  above,
  onSubmit,
}: {
  children?: React.ReactNode
  cta?: React.ReactNode
  below?: React.ReactNode
  above?: React.ReactNode
  onSubmit?: (e: React.FormEvent) => void
}) {
  const Container = onSubmit ? "form" : "div"
  const { title, logo } = useSiteSettings()
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="game-bg relative flex flex-1 flex-col items-center overflow-hidden px-4 pt-[8vh] pb-[6vh]">
        {above && <div className="absolute top-5 right-5 z-20">{above}</div>}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="w-[min(80vw,520px)]">
          {logo ? <Logo src={logo} alt={title} /> : <h1 className="text-center font-display text-5xl font-black tracking-tight text-balance md:text-6xl">{title}</h1>}
        </motion.div>
        <Container onSubmit={onSubmit} className="flex w-full flex-1 flex-col items-center">
          {children}
          <div className="mt-auto flex w-full flex-col items-center gap-5 pt-[5vh]">
            {cta}
            {below}
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  )
}

export function PrimaryButton({
  children,
  busy,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode
  busy?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      disabled={disabled || busy}
      onClick={onClick}
      className={cn(
        "inline-flex h-14 w-full max-w-md cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground px-8 font-display text-xl font-bold tracking-wide text-background uppercase shadow-[0_10px_30px_rgb(0_0_0/45%)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100",
        className,
      )}
    >
      {busy && <Loader2Icon className="size-5 animate-spin" />}
      {children}
    </button>
  )
}

export function NicknameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      id="nickname"
      name="nickname"
      type="text"
      value={value}
      maxLength={20}
      autoFocus
      autoComplete="off"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
      placeholder="VOTRE PSEUDO…"
      aria-label="Votre pseudo"
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className="mt-[6vh] h-14 w-full max-w-md border-b border-foreground/30 bg-transparent px-2 text-center font-display text-2xl tracking-[0.12em] uppercase outline-none placeholder:text-foreground/35 focus:border-foreground"
    />
  )
}

const SLOT = "size-11 bg-surface-dark/80 font-display text-lg uppercase"

export function CodeField({ value, onChange, copyable }: { value: string; onChange?: (v: string) => void; copyable?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    if (!copyable) return
    try {
      await navigator.clipboard.writeText(copyable)
      setCopied(true)
      toast.success("Lien de la partie copié !")
      setTimeout(() => setCopied(false), 1600)
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
        aria-label="Code de la partie"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
      >
        <InputOTPGroup>
          {[0, 1, 2].map((i) => (
            <InputOTPSlot key={i} index={i} className={cn(SLOT, !onChange && "opacity-100")} />
          ))}
        </InputOTPGroup>
        <InputOTPSeparator className="text-foreground/60" />
        <InputOTPGroup>
          {[3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} className={cn(SLOT, !onChange && "opacity-100")} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {copyable && (
        <button
          type="button"
          onClick={copy}
          aria-label="Copier le lien de la partie"
          className="absolute -right-14 flex size-11 cursor-pointer items-center justify-center rounded-lg border border-foreground/40 bg-surface-dark/80 transition-transform hover:scale-110"
        >
          {copied ? <CheckIcon className="size-5" /> : <CopyIcon className="size-5" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  )
}

export function Paragraph({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15 }}
      className={cn("mt-[3vh] max-w-2xl text-center text-lg leading-snug text-balance text-foreground/80", className)}
    >
      {children}
    </motion.div>
  )
}

function Footer() {
  const { title, credits } = useSiteSettings()
  const link = "underline decoration-foreground/30 underline-offset-2 hover:text-foreground"
  const publisher = credits.publisher ? (
    credits.publisherUrl ? (
      <a href={credits.publisherUrl} target="_blank" rel="noreferrer" className={link}>
        {credits.publisher}
      </a>
    ) : (
      credits.publisher
    )
  ) : null
  return (
    <footer className="relative z-20 shrink-0 bg-surface-dark px-4 pt-[4vh] pb-[3vh] text-center text-xs leading-relaxed text-foreground/55">
      {credits.authors && (
        <p>
          Adaptation en ligne non officielle et gratuite de <em>{title}</em>, un jeu de {credits.authors}
          {publisher && <> et édité par {publisher}</>}. Tous droits réservés à leurs auteurs{publisher ? " et à l\u2019éditeur" : ""}.
        </p>
      )}
      <p>
        Développé par{" "}
        <a href={AUTHOR.url} target="_blank" rel="noreferrer" className={link}>
          {AUTHOR.signature}
        </a>{" "}
        · Pour toute réclamation :{" "}
        <a href={`mailto:${CONTACT}`} className={link}>
          {CONTACT}
        </a>
      </p>
    </footer>
  )
}
