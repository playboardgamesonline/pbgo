"use client"

import { Sent02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { SmilePlusIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import * as binding from "@pbgo/binding"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { openChat, type ChatMessage } from "../../lib/realtime"
import { DEFAULT_REACTIONS, playReaction, prepareSoundboard, type Reaction } from "../../lib/soundboard"
import { useText } from "../skin-provider"
import { useGame } from "./context"

const VISIBLE_MS = 9000
const KEEP = 40
const MAX_LENGTH = 240
const MIN_GAP_MS = 700
const REACTION_GAP_MS = 350
const PARTICLES = 9
const REACTIONS: Reaction[] = (binding as { REACTIONS?: Reaction[] }).REACTIONS ?? DEFAULT_REACTIONS

type Particle = { id: string; emoji: string; x: number; drift: number; size: number; delay: number; duration: number }

function burst(emoji: string): Particle[] {
  return Array.from({ length: PARTICLES }, () => ({
    id: crypto.randomUUID(),
    emoji,
    x: 12 + Math.random() * 76,
    drift: (Math.random() - 0.5) * 90,
    size: 22 + Math.random() * 22,
    delay: Math.random() * 0.25,
    duration: 1.5 + Math.random() * 1.1,
  }))
}

/**
 * Chat de la partie, en bas à droite : les messages s'affichent puis s'effacent en fondu ; en survolant ou en écrivant, l'historique récent réapparaît.
 * Pseudos dans la couleur du joueur. Diffusion temps réel sans stockage (rien n'est conservé quand la partie est quittée).
 */
export function Chat({ className }: { className?: string }) {
  const t = useText()
  const { game, nickname, color } = useGame()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [active, setActive] = useState(false)
  const [board, setBoard] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const lastReaction = useRef(0)
  const [, tick] = useState(0)
  const channel = useRef<ReturnType<typeof openChat> | null>(null)
  const last = useRef(0)
  const list = useRef<HTMLUListElement>(null)
  const meId = game.meId

  const showReaction = useCallback((playerId: string, reaction: Reaction, local: boolean) => {
    setParticles((all) => [...all, ...burst(reaction.emoji)].slice(-60))
    setMessages((all) => [...all, { id: crypto.randomUUID(), playerId, text: reaction.emoji, at: Date.now() }].slice(-KEEP))
    if (!local) playReaction(reaction)
  }, [])

  useEffect(() => {
    const c = openChat(
      game.code,
      (m) => setMessages((all) => [...all, m].slice(-KEEP)),
      (r) => {
        const reaction = REACTIONS.find((x) => x.id === r.reaction)
        if (reaction) showReaction(r.playerId, reaction, false)
      },
    )
    channel.current = c
    return () => {
      c?.close()
      channel.current = null
    }
  }, [game.code, showReaction])

  // réaffiche périodiquement pour laisser les messages s'effacer
  const recent = messages.some((m) => Date.now() - m.at < VISIBLE_MS)
  useEffect(() => {
    if (!recent) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [recent, messages])

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length, active])

  function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim().slice(0, MAX_LENGTH)
    if (!body || !meId || Date.now() - last.current < MIN_GAP_MS) return
    last.current = Date.now()
    const m: ChatMessage = { id: crypto.randomUUID(), playerId: meId, text: body, at: Date.now() }
    channel.current?.send(m)
    setMessages((all) => [...all, m].slice(-KEEP))
    setText("")
  }

  function react(reaction: Reaction) {
    if (!meId || Date.now() - lastReaction.current < REACTION_GAP_MS) return
    lastReaction.current = Date.now()
    prepareSoundboard()
    playReaction(reaction)
    channel.current?.react({ id: crypto.randomUUID(), playerId: meId, reaction: reaction.id })
    showReaction(meId, reaction, true)
  }

  if (!meId) return null
  const now = Date.now()
  return (
    <div
      className={cn("pointer-events-none fixed right-5 bottom-5 z-30 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2", className)}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => {
        setActive(false)
        setBoard(false)
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-12 h-72 overflow-visible" aria-hidden>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute bottom-0 select-none"
            style={{ left: `${p.x}%`, fontSize: p.size }}
            initial={{ y: 0, x: 0, opacity: 0, scale: 0.4 }}
            animate={{ y: -240 - p.size * 2, x: p.drift, opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 0.9] }}
            transition={{ duration: p.duration, delay: p.delay, ease: "easeOut", times: [0, 0.15, 0.7, 1] }}
            onAnimationComplete={() => setParticles((all) => all.filter((x) => x.id !== p.id))}
          >
            {p.emoji}
          </motion.span>
        ))}
      </div>
      <div className="relative h-60 [mask-image:linear-gradient(to_bottom,transparent_0%,black_55%)]">
      <ul
        ref={list}
        aria-live="polite"
        aria-label={t("chat")}
        className={cn(
          "pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-full flex-col justify-end gap-1 overflow-y-auto pr-1 [scrollbar-width:none]",
          !active && "pointer-events-none",
        )}
      >
        {messages.map((m) => {
          const shown = active || now - m.at < VISIBLE_MS
          return (
            <li
              key={m.id}
              className={cn(
                "w-fit max-w-full rounded-lg bg-black/45 px-3 py-1.5 text-sm leading-snug text-foreground backdrop-blur-[2px] transition-opacity duration-700 [text-shadow:0_1px_4px_rgb(0_0_0/70%)]",
                shown ? "opacity-100" : "hidden opacity-0",
              )}
            >
              <span className="mr-1.5 font-black tracking-wide uppercase brightness-150" style={{ color: color(m.playerId) }}>
                {nickname(m.playerId)}
              </span>
              <span className="break-words">{m.text}</span>
            </li>
          )
        })}
      </ul>
      </div>
      <form onSubmit={send} className="pointer-events-auto flex items-center gap-1 rounded-full border border-foreground/20 bg-black/40 py-1 pr-1 pl-4 opacity-60 backdrop-blur-sm transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          maxLength={MAX_LENGTH}
          placeholder={t("chatPlaceholder")}
          aria-label={t("chatPlaceholder")}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/50"
        />
        <div className="relative">
          <AnimatePresence>
            {board && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 bottom-11 grid w-44 grid-cols-4 gap-1 rounded-2xl border border-foreground/20 bg-black/70 p-2 backdrop-blur-md"
              >
                {REACTIONS.map((r) => (
                  <button key={r.id} type="button" title={r.label} aria-label={r.label} onClick={() => react(r)} className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-xl transition-transform hover:scale-125 hover:bg-foreground/10 active:scale-95">
                    {r.emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <button type="button" aria-label={t("chatReactions")} aria-expanded={board} title={t("chatReactions")} onClick={() => { prepareSoundboard(); setBoard((b) => !b) }} className={cn("flex size-8 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10", board && "bg-foreground/15")}>
            <SmilePlusIcon className="size-4.5" strokeWidth={1.8} />
          </button>
        </div>
        <button type="submit" disabled={!text.trim()} aria-label={t("chatSend")} title={t("chatSend")} className="flex size-8 cursor-pointer items-center justify-center rounded-full text-foreground transition-opacity disabled:cursor-default disabled:opacity-30">
          <HugeiconsIcon icon={Sent02Icon} strokeWidth={1.8} className="size-4.5" />
        </button>
      </form>
    </div>
  )
}
