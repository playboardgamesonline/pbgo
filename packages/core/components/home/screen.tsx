"use client"

import { CheckIcon, CopyIcon, Loader2Icon } from "lucide-react"
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { motion } from "motion/react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Logo } from "@pbgo/binding-ui"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@pbgo/ui/game/input-otp"
import { useSiteSettings } from "../settings-provider"
import { useSkin, useText } from "../skin-provider"
import { Toolbar } from "../toolbar"
import { AUTHOR, CONTACT } from "@pbgo/binding"
import { cn } from "@pbgo/ui/utils"

/**
 * Écran standard hors partie (accueil, invitation, lobby), repris de Courtisans :
 * fond + motif, décor haut, logo animé, contenu, personnage debout sur le décor bas, bouton principal et code posés sur le décor,
 * son et règles en haut à droite, pied de page. Toutes les images viennent de l'habillage (Sanity `interface`) et sont facultatives.
 */
export function Screen({
  children,
  cta,
  below,
  onSubmit,
}: {
  children?: React.ReactNode
  cta?: React.ReactNode
  below?: React.ReactNode
  onSubmit?: (e: React.FormEvent) => void
}) {
  const { title, logo } = useSiteSettings()
  const { decor } = useSkin()
  // hauteur du décor bas = largeur affichée (114vw) / ratio de l'image
  const decorHeight = decor.bottom?.ratio ? `calc(114vw / ${decor.bottom.ratio})` : "0px"
  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-background" style={{ "--decor-h": decorHeight } as React.CSSProperties}>
      {decor.background && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={decor.background} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover select-none" />
      )}
      {decor.pattern && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[length:128px_128px] opacity-[0.07]"
          style={{ backgroundImage: `url(${decor.pattern})` }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,color-mix(in_oklab,var(--surface),white_12%),transparent_65%)] opacity-70"
      />
      {decor.top && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={decor.top.url}
          srcSet={decor.top.srcSet}
          sizes="114vw"
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute top-0 left-[-7%] w-[114%] max-w-none select-none"
        />
      )}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
        <Toolbar align="right" />
      </div>

      <form autoComplete="off" onSubmit={onSubmit ?? ((e) => e.preventDefault())} className="relative z-10 flex min-h-0 flex-1 flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="mt-[7vh] w-[min(27rem,72vw,32vh)] shrink-0"
        >
          <Link href="/" aria-label="Accueil" className="block">
            {logo ? (
              <Logo src={logo} alt={title} />
            ) : (
              <h1 className="text-center font-display text-5xl font-black tracking-tight text-balance md:text-6xl">{title}</h1>
            )}
          </Link>
        </motion.div>

        {children}

        <div className="relative mt-[2vh] min-h-0 w-full flex-1">
          {decor.hero && (
            <motion.img
              src={decor.hero}
              alt=""
              aria-hidden
              draggable={false}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 90, damping: 16 }}
              className="pointer-events-none absolute bottom-[calc(var(--decor-h)*0.18)] left-1/2 h-[min(calc(100%-var(--decor-h)*0.18),34vh)] w-auto -translate-x-1/2 object-contain object-bottom drop-shadow-[0_10px_24px_rgb(0_0_0/50%)] select-none"
            />
          )}
          {decor.bottom && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={decor.bottom.url}
              srcSet={decor.bottom.srcSet}
              sizes="114vw"
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute -bottom-2 left-[-7%] h-auto w-[114%] max-w-none select-none"
            />
          )}
          <div className="absolute inset-x-0 bottom-[max(calc(var(--decor-h)*0.1),4vh)] flex flex-col items-center gap-6 px-4">
            {cta}
            {below}
          </div>
        </div>
      </form>

      <Footer />
    </main>
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
        "inline-flex h-16 w-full max-w-md cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground px-8 font-display text-2xl tracking-wide text-background shadow-[0_10px_30px_rgb(0_0_0/55%),0_0_28px_color-mix(in_oklab,var(--foreground)_30%,transparent)] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98] disabled:cursor-default disabled:hover:scale-100",
        disabled && "bg-[color-mix(in_oklab,var(--foreground)_62%,var(--background))] shadow-none",
        className,
      )}
    >
      {busy && <Loader2Icon className="size-5 animate-spin" />}
      {children}
    </button>
  )
}

const NO_AUTOFILL = { autoComplete: "off", "data-1p-ignore": true, "data-lpignore": "true", "data-bwignore": "true", "data-form-type": "other" } as const

export function NicknameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useText()
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-[6vh] w-full max-w-md shrink-0 px-4">
      <input
        id="nickname"
        name="nickname"
        type="text"
        value={value}
        maxLength={20}
        autoFocus
        autoCorrect="off"
        spellCheck={false}
        {...NO_AUTOFILL}
        placeholder={t("nicknamePlaceholder")}
        aria-label={t("nicknamePlaceholder").replace(/…$/, "")}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-14 w-full border-b border-foreground/30 bg-transparent px-2 text-center font-display text-xl tracking-[0.12em] uppercase outline-none placeholder:text-foreground/35 focus:border-foreground md:text-2xl"
      />
    </motion.div>
  )
}

const SLOT = "size-11 bg-surface-dark/80 font-display text-lg uppercase"

export function CodeField({ value, onChange, copyable }: { value: string; onChange?: (v: string) => void; copyable?: string }) {
  const t = useText()
  const [copied, setCopied] = useState(false)
  async function copy() {
    if (!copyable) return
    try {
      await navigator.clipboard.writeText(copyable)
      setCopied(true)
      toast.success(t("linkCopied"))
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
        aria-label={t("codeLabel")}
        name="game-code"
        {...NO_AUTOFILL}
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
          aria-label={t("copyLink")}
          title={t("copyLink")}
          className="absolute -right-14 flex size-11 cursor-pointer items-center justify-center rounded-lg border border-foreground/50 bg-surface-dark/80 text-foreground transition-transform hover:scale-110"
        >
          {copied ? <CheckIcon className="size-5" /> : <CopyIcon className="size-5" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  )
}

// Police d'ambiance (annonces, introduction) : variable CSS --font-accent du jeu, sinon la police des titres
const ACCENT_FONT = "var(--font-accent, var(--font-title))"

/** Titre + texte d'introduction (accueil). */
export function Intro({ title, children }: { title?: string | null; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="mt-[3vh] max-w-5xl shrink-0 space-y-2 px-4 text-center [text-shadow:0_1px_6px_rgb(0_0_0/60%)]"
    >
      {title && (
        <h2 className="text-lg tracking-[0.1em] text-foreground uppercase md:text-xl" style={{ fontFamily: ACCENT_FONT }}>
          {title}
        </h2>
      )}
      <div className="mx-auto max-w-5xl space-y-1.5 text-[0.95rem] leading-relaxed whitespace-pre-line text-foreground/80 md:text-base" style={{ fontFamily: ACCENT_FONT }}>
        {children}
      </div>
    </motion.div>
  )
}

export function Paragraph({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className={cn("mt-[2.5vh] max-w-2xl shrink-0 px-4 text-center text-lg leading-snug text-balance text-foreground/85 [text-shadow:0_1px_6px_rgb(0_0_0/60%)]", className)}
    >
      {children}
    </motion.p>
  )
}

function Footer() {
  const { title, credits } = useSiteSettings()
  const t = useText()
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
          {t("creditsAdaptation")} <em>{title}</em>, {t("creditsBy")} {credits.authors}
          {publisher && <> {t("creditsPublishedBy")} {publisher}</>}. {publisher ? t("creditsRightsPublisher") : t("creditsRights")}
        </p>
      )}
      <p>
        {t("developedBy")}{" "}
        <a href={AUTHOR.url} target="_blank" rel="noreferrer" className={link}>
          {AUTHOR.signature}
        </a>{" "}
        · {t("claims")}{" "}
        <a href={`mailto:${CONTACT}`} className={link}>
          {CONTACT}
        </a>
      </p>
    </footer>
  )
}
