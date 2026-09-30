"use client"

import { Scroll01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { FileTextIcon, PlayIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@pbgo/ui/game/dialog"
import { ScrollArea } from "@pbgo/ui/game/scroll-area"
import type { RulesContent } from "../lib/rules"
import { LOCALES } from "../lib/i18n"
import { useSiteSettings } from "./settings-provider"
import { useSkin, useText } from "./skin-provider"
import { cn } from "@pbgo/ui/utils"

export function RichText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={cn(i > 0 && "mt-[0.7em]")}>
            {p.split(/(\*\*[^*]+\*\*)/).map((m, j) =>
              m.startsWith("**") && m.endsWith("**") ? (
                <strong key={j}>{m.slice(2, -2)}</strong>
              ) : (
                m.split("\n").flatMap((l, k) => (k ? [<br key={`${j}-${k}`} />, l] : [l]))
              ),
            )}
          </p>
        ))}
    </>
  )
}

export function RulesButton({ rules, className }: { rules: RulesContent; className?: string }) {
  const t = useText()
  const { locale } = useSkin()
  const tabs = [...rules.sections.map((s) => s.title), ...(rules.videoId ? [t("rulesVideo")] : [])]
  const [active, setActive] = useState(0)
  const section = rules.sections[active]
  const { title: gameTitle, rulesPdf } = useSiteSettings()
  // PDF de la langue du joueur d'abord, puis les autres
  const pdfs = [locale, ...LOCALES.filter((l) => l !== locale)]
    .map((l) => ({ lang: l.toUpperCase(), url: rulesPdf[l] }))
    .filter((p): p is { lang: string; url: string } => !!p.url)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("rulesTitle")}
          title={t("rulesTitle")}
          className={cn("flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground transition-transform hover:scale-110", className)}
        >
          <HugeiconsIcon icon={Scroll01Icon} strokeWidth={1.6} className="size-7 drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex h-[80vh] w-[min(95vw,64rem)] max-w-none gap-0 overflow-hidden rounded-2xl border-0 bg-secondary p-0 text-secondary-foreground sm:max-w-none">
        <nav className="flex w-64 shrink-0 flex-col gap-1 bg-surface p-5 text-foreground">
          <DialogTitle className="px-3 pb-1 font-display text-2xl">{t("rules")}</DialogTitle>
          <DialogDescription className="px-3 pb-5 text-sm text-foreground/60">{gameTitle}</DialogDescription>
          {tabs.map((title, i) => (
            <button
              key={title}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left font-display whitespace-nowrap transition-colors",
                active === i ? "text-secondary-foreground" : "text-foreground/70 hover:text-foreground",
              )}
            >
              {active === i && <motion.span layoutId="rules-tab" className="absolute inset-0 rounded-lg bg-secondary" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              {i >= rules.sections.length && <PlayIcon className="relative size-4" />}
              <span className="relative">{title}</span>
            </button>
          ))}
          {pdfs.length > 0 && (
            <div className="mt-auto flex flex-col gap-1 border-t border-foreground/10 pt-4">
              {pdfs.map((p) => (
                <a
                  key={p.lang}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/70 transition-colors hover:text-foreground"
                >
                  <FileTextIcon className="size-4" />
                  {t("rulesPdf", { lang: p.lang })}
                </a>
              ))}
            </div>
          )}
        </nav>
        <ScrollArea className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="p-10">
              {section ? (
                <>
                  <h3 className="font-display text-3xl font-bold">{section.title}</h3>
                  {active === 0 && <p className="mt-2 text-secondary-foreground/60">{rules.intro}</p>}
                  <div className="mt-6 max-w-3xl text-lg leading-[1.45]">
                    <RichText text={section.text} />
                  </div>
                  {section.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={section.image} alt="" className="mt-8 max-h-96 rounded-xl object-contain" />
                  )}
                </>
              ) : (
                <div className="overflow-hidden rounded-xl bg-black">
                  <iframe
                    className="aspect-video w-full"
                    src={`https://www.youtube-nocookie.com/embed/${rules.videoId}?rel=0`}
                    title={t("rulesVideoTitle")}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
