"use client"

import { CrownIcon, HourglassIcon, PlayIcon, ScrollTextIcon, SwordsIcon, TrophyIcon } from "lucide-react"
import { CatalogueIcon, Scroll01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Button } from "@pgo/ui/game/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@pgo/ui/game/dialog"
import { ScrollArea } from "@pgo/ui/game/scroll-area"
import { type RulesCatalog, DEFAULT_RULES, type RoleRules } from "@/lib/catalog"
import { cn } from "@pgo/ui/utils"

export const ICON_BUTTON_CLASS =
  "size-11 cursor-pointer rounded-full bg-transparent text-foreground transition-transform hover:scale-110 hover:bg-transparent hover:text-foreground active:scale-95 dark:hover:bg-transparent"

const TABS = [
  { key: "goal", title: "goalTitle", icon: CrownIcon },
  { key: "flow", title: "flowTitle", icon: HourglassIcon },
  { key: "turn", title: "turnTitle", icon: ScrollTextIcon },
  { key: "roles", title: "rolesTitle", icon: SwordsIcon },
  { key: "scoring", title: "scoringTitle", icon: TrophyIcon },
] as const
const VIDEO = { key: "video", title: "videoTitle", icon: PlayIcon } as const
type Tab = (typeof TABS)[number]["key"] | "video"

function StatusTag({ type }: { type: "light" | "disgrace" | "neutral" }) {
  const styles = {
    light: "bg-[#f6e7b8] text-[#8a5a12] ring-[#d9a93f]/70",
    disgrace: "bg-[#12322f] text-[#e7c46a] ring-[#d9a93f]/50",
    neutral: "bg-[#7b8384] text-white ring-[#9aa1a2]",
  }
  const text = { light: "dans la lumière", disgrace: "en disgrâce", neutral: "neutre" }
  return <span className={cn("rounded-md px-1.5 py-px text-[0.92em] whitespace-nowrap ring-1", styles[type])}>{text[type]}</span>
}

function Rich({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length > 1)
    return (
      <>
        {paragraphs.map((p, i) => (
          <span key={i} className={cn("block", i > 0 && "mt-[0.7em]")}>
            <Line text={p} />
          </span>
        ))}
      </>
    )
  return <Line text={text.trim()} />
}

function Line({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{(?:light|lumiere|disgrace|neutral|neutre)\}|\*\*[^*]+\*\*)/).map((piece, i) => {
        // balises de statut dans les textes Sanity : {light} {disgrace} {neutral} (anciennes formes {lumiere} {neutre} acceptées)
        if (piece === "{light}" || piece === "{lumiere}") return <StatusTag key={i} type="light" />
        if (piece === "{disgrace}") return <StatusTag key={i} type="disgrace" />
        if (piece === "{neutral}" || piece === "{neutre}") return <StatusTag key={i} type="neutral" />
        if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={i}>{piece.slice(2, -2)}</strong>
        return piece.split("\n").flatMap((l, j) => (j ? [<br key={`${i}-${j}`} />, l] : [l]))
      })}
    </>
  )
}

function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 max-w-4xl">
      <h3 className="font-display text-4xl tracking-[0.04em] text-[#0e3940] uppercase">{title}</h3>
      {children && <div className="mt-3 text-lg leading-[1.45] text-[#1f2b2d]/80">{children}</div>}
    </header>
  )
}

function Card({ number, title, subtitle, children }: { number?: number; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#0e3940]/15 pt-4">
      <div className="flex items-center gap-3">
        {number !== undefined && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0e3940] font-display text-sm text-[#f6e7b8]">
            {number}
          </span>
        )}
        <div>
          <p className="font-display text-lg text-[#0e3940]">{title}</p>
          {subtitle && <p className="text-sm text-[#1f2b2d]/55 italic">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-2 leading-[1.45] text-[#1f2b2d]/85">{children}</div>
    </div>
  )
}

function maskUrl(src: string) {
  return /^https:\/\/cdn\.sanity\.io\//.test(src) ? `/api/media?url=${encodeURIComponent(src)}` : src
}

function Pictogram({ src, frame, className }: { src: string | null; frame: string; className?: string }) {
  return (
    <div aria-hidden className={cn("relative size-14 shrink-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frame} alt="" className="absolute inset-0 size-full" />
      {src && (
        <span
          className="absolute inset-[27%] bg-[#e7c46a]"
          style={{
            maskImage: `url("${maskUrl(src)}")`,
            WebkitMaskImage: `url("${maskUrl(src)}")`,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
      )}
    </div>
  )
}

function CardImage({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className={cn("absolute h-auto shadow-[0_10px_24px_rgb(14_57_64/30%)]", className)} />
  )
}

function Role({ role, frame, children }: { role: RoleRules; frame: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-6 border-t border-[#0e3940]/15 pt-5">
      <div aria-hidden className="relative h-[10rem] w-[7.6rem] shrink-0">
        <CardImage src={role.cards[0]} className="top-0 left-0 w-[4.8rem] -rotate-[8deg] rounded-md" />
        <CardImage src={role.cards[1]} className="top-[1.1rem] left-[2.7rem] w-[4.8rem] rotate-[5deg] rounded-md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Pictogram src={role.pictogramUrl} frame={frame} />
          {role.letteringUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={role.letteringUrl} alt={role.name} className="h-9 w-auto" />
          ) : (
            <p className="font-display text-2xl text-[#0e3940]">{role.name}</p>
          )}
          <span className="font-display text-xl whitespace-nowrap text-[#0e3940]">
            × {role.count} <span className="text-base text-[#0e3940]/70">par famille</span>
          </span>
        </div>
        <div className="mt-2 leading-[1.45] text-[#1f2b2d]/85">{children}</div>
      </div>
    </div>
  )
}

const ROLE_ORDER = ["noble", "guard", "spy", "assassin"] as const

function Content({ tab, rules }: { tab: Tab; rules: RulesCatalog }) {
  const t = rules.texts
  switch (tab) {
    case "video":
      return (
        <>
          <Heading title={t.videoTitle} />
          <div className="overflow-hidden rounded-2xl bg-black shadow-[0_16px_40px_rgb(14_57_64/30%)]">
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${t.videoId}?rel=0`}
              title="Courtisans – règles en vidéo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </>
      )
    case "goal":
      return (
        <>
          <Heading title={t.goalTitle}>
            <Rich text={t.goalIntro} />
          </Heading>
          <Card title="Six familles">
            <Rich text={t.goalFamilies} />
          </Card>
          <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-10 sm:grid-cols-6">
            {rules.families.map((f, i) => (
              <div key={f.key} className="flex flex-col items-center">
                <div className="relative w-full max-w-[7.5rem]" style={{ rotate: `${i % 2 ? 2 : -2}deg` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.cardUrl}
                    alt=""
                    draggable={false}
                    className="aspect-[472/890] w-full rounded-lg object-cover shadow-[0_10px_24px_rgb(14_57_64/30%)]"
                  />
                  <Pictogram src={f.pictogramUrl} frame={rules.pictoFrame} className="absolute -bottom-6 left-1/2 size-12 -translate-x-1/2" />
                </div>
                <p className="mt-8 font-display text-lg tracking-[0.08em] text-[#0e3940] uppercase">{f.name}</p>
                <span aria-hidden className="mt-1 h-1 w-8 rounded-full" style={{ backgroundColor: f.color }} />
              </div>
            ))}
          </div>
          <div className="mt-12 grid items-center gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <Card title="Deux missions secrètes">
              <Rich text={t.goalMissions} />
            </Card>
            <div aria-hidden className="relative mx-auto h-[15.5rem] w-[22rem]">
              <CardImage src={rules.missions[0]} className="top-0 left-0 w-[16.5rem] -rotate-[5deg] rounded-xl" />
              <CardImage src={rules.missions[1]} className="right-0 bottom-0 w-[16.5rem] rotate-[4deg] rounded-xl" />
            </div>
          </div>
        </>
      )
    case "flow":
      return (
        <>
          <Heading title={t.flowTitle}>
            <Rich text={t.flowIntro} />
          </Heading>
          <div className="grid max-w-4xl gap-y-6">
            <Card number={1} title="Le tapis et la pioche">
              <Rich text={t.flowMat} />
            </Card>
            <Card number={2} title="Votre main">
              <Rich text={t.flowHand} />
            </Card>
            <Card number={3} title="Vos missions">
              <Rich text={t.flowMissions} />
            </Card>
          </div>
          <div className="mt-6 flex max-w-4xl items-center gap-4 rounded-2xl bg-[#0e3940] px-6 py-4 text-[#f3ecd6]">
            <CrownIcon className="size-6 shrink-0 text-[#e7c46a]" />
            <div>
              <Rich text={t.flowStart} />
            </div>
          </div>
        </>
      )
    case "turn":
      return (
        <>
          <Heading title={t.turnTitle}>
            <Rich text={t.turnIntro} />
          </Heading>
          <div className="grid max-w-4xl gap-y-6">
            <Card number={1} title="À la table de la reine" subtitle="autour du tapis">
              <Rich text={t.turnTable} />
            </Card>
            <Card number={2} title="Dans votre domaine" subtitle="devant vous">
              <Rich text={t.turnDomain} />
            </Card>
            <Card number={3} title="Dans un domaine adverse" subtitle="devant l'adversaire de votre choix">
              <Rich text={t.turnOpponent} />
            </Card>
          </div>
          <div className="mt-6 flex max-w-4xl items-center gap-4 rounded-2xl bg-[#0e3940] px-6 py-4 text-[#f3ecd6]">
            <ScrollTextIcon className="size-6 shrink-0 text-[#e7c46a]" />
            <div>
              <strong className="font-display text-[#f6e7b8]">Fin du tour</strong> — <Rich text={t.turnEnd} />
            </div>
          </div>
        </>
      )
    case "roles":
      return (
        <>
          <Heading title={t.rolesTitle}>
            <Rich text={t.rolesIntro} />
          </Heading>
          <div className="grid max-w-4xl gap-y-6">
            {ROLE_ORDER.map((key) => (
              <Role key={key} role={rules.roles[key]} frame={rules.pictoFrame}>
                <Rich text={rules.roles[key].text} />
              </Role>
            ))}
          </div>
        </>
      )
    case "scoring":
      return (
        <>
          <Heading title={t.scoringTitle}>
            <Rich text={t.scoringIntro} />
          </Heading>
          <div className="grid gap-x-8 gap-y-8 lg:grid-cols-3">
            <Card number={1} title="Les espions sont révélés">
              <Rich text={t.scoringReveal} />
            </Card>
            <Card number={2} title="Le statut des familles">
              <Rich text={t.scoringStatus} />
            </Card>
            <Card number={3} title="Les points">
              <Rich text={t.scoringPoints} />
            </Card>
          </div>
        </>
      )
  }
}

function TabButton({ tab, active, name, onClick }: { tab: { icon: typeof PlayIcon }; active: boolean; name: string; onClick: () => void }) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left font-display text-[1.05rem] whitespace-nowrap transition-colors",
        active ? "text-[#0e3940]" : "text-[#f3ecd6]/75 hover:text-[#f6e7b8]",
      )}
    >
      {active && (
        <motion.span
          layoutId="onglet-regles"
          className="absolute inset-0 rounded-xl bg-[#f3ecd6]"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
        />
      )}
      <Icon className="relative size-5" strokeWidth={1.6} />
      <span className="relative">{name}</span>
    </button>
  )
}

export function RulesButton({ className, icon, rules = DEFAULT_RULES }: { className?: string; icon?: boolean; rules?: RulesCatalog }) {
  const [tab, setTab] = useState<Tab>("goal")
  return (
    <Dialog>
      <DialogTrigger asChild>
        {icon ? (
          <Button variant="ghost" size="icon" aria-label="Règles du jeu" title="Règles du jeu" className={cn(ICON_BUTTON_CLASS, className)}>
            <HugeiconsIcon icon={Scroll01Icon} strokeWidth={1.6} className="size-7 drop-shadow-[0_1px_3px_rgb(0_0_0/60%)]" />
          </Button>
        ) : (
          <Button variant="outline" className={className}>
            <HugeiconsIcon icon={CatalogueIcon} />
            Règles du jeu
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[86vh] w-[min(95vw,92rem)] max-w-none gap-0 overflow-hidden rounded-3xl border-0 bg-[#f3ecd6] p-0 text-[#1f2b2d] shadow-[0_30px_80px_rgb(0_0_0/55%)] sm:max-w-none">
        <nav className="relative flex w-80 shrink-0 flex-col bg-[#0e3940] px-4 py-7 text-[#f3ecd6]">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-(image:--image-pattern) bg-[length:110px_110px] opacity-[0.06]" />
          <div className="relative px-3 pb-8">
            <DialogTitle className="font-display text-2xl text-[#f6e7b8]">Règles du jeu</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[#f3ecd6]/60">2 à 5 joueurs · 30 minutes</DialogDescription>
          </div>
          <ul className="relative space-y-1">
            {TABS.map((o) => (
              <li key={o.key}>
                <TabButton tab={o} active={tab === o.key} name={rules.texts[o.title]} onClick={() => setTab(o.key)} />
              </li>
            ))}
          </ul>
          <div className="relative mt-auto border-t border-[#f3ecd6]/15 pt-4">
            <TabButton tab={VIDEO} active={tab === "video"} name={rules.texts.videoTitle} onClick={() => setTab("video")} />
          </div>
        </nav>
        <div className="relative flex min-w-0 flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-(image:--image-paper) bg-cover bg-center opacity-45 mix-blend-multiply"
          />
          <ScrollArea className="relative min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="px-10 py-10"
              >
                <Content tab={tab} rules={rules} />
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Bouton des règles branché sur @pgo/core (`RulesButton` de @pgo/binding-ui) : `rules` = règles de Courtisans chargées par `loadRules` (binding-server). */
export function CourtisansRulesButton({ rules, className }: { rules: unknown; className?: string }) {
  const content = rules && typeof rules === "object" && "roles" in rules ? (rules as RulesCatalog) : DEFAULT_RULES
  return <RulesButton icon className={className} rules={content} />
}
