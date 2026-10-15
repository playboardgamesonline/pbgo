"use client"

import { Sent02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { MessageCircleIcon, SmilePlusIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { useApi, useBinding } from "../../lib/binding-context"
import { CHAT_MAX_LENGTH } from "../../lib/chat"
import { EASE_STANDARD, fade, travel } from "../../lib/motion-preference"
import { openChat, type ChatMessage } from "../../lib/realtime"
import { gameReactions, playReaction, prepareSoundboard, reactionLabel, type Reaction } from "../../lib/soundboard"
import { useMotion } from "../../lib/use-motion"
import { useText } from "../skin-provider"
import { useGame } from "./context"
import { HUD_PANEL, HUD_TEXT, HUD_TRANSITION, readableColor } from "./hud-ui"

const VISIBLE_MS = 9000
const KEEP = 40
const MIN_GAP_MS = 700
const REACTION_GAP_MS = 350
const PARTICLES = 9

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
 * Chat of the game, bottom right: messages show up then fade out; hovering or typing brings the recent history back.
 * Nicknames in the player's color. Realtime broadcast without storage (nothing is kept once the game is left).
 * Sending goes through the chat API route (author = player cookie); the channel is only listened to.
 *
 * A reaction is a message made of its emoji (and its sound). Lively games (`UI_THEME.motion`) also let the emojis float up the
 * screen; a calm game, or a visitor who prefers reduced motion, only gets the message.
 *
 * On a short viewport (a phone held sideways) the input is folded behind a round button; the messages still show up above it.
 */
export function Chat({ className }: { className?: string }) {
  const t = useText()
  const { SLUG, REACTIONS: own } = useBinding()
  const api = useApi()
  const motionMode = useMotion()
  const reactions = gameReactions(own)
  const { game, nickname, color } = useGame()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [active, setActive] = useState(false)
  const [board, setBoard] = useState(false)
  // short viewport only: the input row is unfolded
  const [open, setOpen] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const lastReaction = useRef(0)
  const [, tick] = useState(0)
  const last = useRef(0)
  const list = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const formId = useId()
  // ids of our own reactions, already played locally: their server broadcast is skipped
  const ownReactions = useRef(new Set<string>())
  // read by the realtime callback, which outlives a render
  const bursts = useRef(false)
  const lively = motionMode === "lively"
  useEffect(() => {
    bursts.current = lively
  }, [lively])
  const meId = game.meId

  const showReaction = useCallback((playerId: string, reaction: Reaction, local: boolean) => {
    if (bursts.current) setParticles((all) => [...all, ...burst(reaction.emoji)].slice(-60))
    setMessages((all) => [...all, { id: crypto.randomUUID(), playerId, text: reaction.emoji, at: Date.now() }].slice(-KEEP))
    if (!local) playReaction(reaction)
  }, [])

  useEffect(() => {
    const c = openChat(
      SLUG,
      game.code,
      // our own messages are already shown (optimistic copy with the same id)
      (m) => setMessages((all) => (all.some((x) => x.id === m.id) ? all : [...all, m].slice(-KEEP))),
      (r) => {
        if (ownReactions.current.delete(r.id)) return
        const reaction = reactions.find((x) => x.id === r.reaction)
        if (reaction) showReaction(r.playerId, reaction, false)
      },
    )
    return () => c?.close()
  }, [SLUG, game.code, reactions, showReaction])

  // re-renders periodically so the messages fade out
  const recent = messages.some((m) => Date.now() - m.at < VISIBLE_MS)
  useEffect(() => {
    if (!recent) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [recent, messages])

  const history = active || open
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length, history])

  // unfolding the input row (short viewport) is typing intent
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim().slice(0, CHAT_MAX_LENGTH)
    if (!body || !meId || Date.now() - last.current < MIN_GAP_MS) return
    last.current = Date.now()
    const m: ChatMessage = { id: crypto.randomUUID(), playerId: meId, text: body, at: Date.now() }
    setMessages((all) => [...all, m].slice(-KEEP))
    setText("")
    // refused by the server (rate limit, left the game…): withdraw the message and give the text back
    api.chat(game.code, { id: m.id, text: body }).catch(() => {
      setMessages((all) => all.filter((x) => x.id !== m.id))
      setText((current) => current || body)
    })
  }

  function react(reaction: Reaction) {
    if (!meId || Date.now() - lastReaction.current < REACTION_GAP_MS) return
    lastReaction.current = Date.now()
    prepareSoundboard()
    playReaction(reaction)
    const id = crypto.randomUUID()
    ownReactions.current.add(id)
    showReaction(meId, reaction, true)
    api.chat(game.code, { id, reaction: reaction.id }).catch(() => ownReactions.current.delete(id))
  }

  // the palette stays open until a click elsewhere (moving from the button to an emoji no longer closes it)
  const boardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!board) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) return void (e.key === "Escape" && setBoard(false))
      if (!boardRef.current?.contains(e.target as Node)) setBoard(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
    }
  }, [board])

  if (!meId) return null
  const now = Date.now()
  const enter = { duration: fade(motionMode, 0.2), ease: EASE_STANDARD }
  return (
    <div
      className={cn(
        "pointer-events-none fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2",
        "short:right-[max(1rem,env(safe-area-inset-right))] short:bottom-[max(0.75rem,env(safe-area-inset-bottom))] short:w-72",
        className,
      )}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-12 h-72 overflow-visible short:h-48" aria-hidden>
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
      <div className={cn("relative h-60 [mask-image:linear-gradient(to_bottom,transparent_0%,black_55%)]", open ? "short:h-32" : "short:h-24")}>
        <ul
          ref={list}
          aria-live="polite"
          aria-label={t("chat")}
          className={cn(
            "pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-full flex-col justify-end gap-1 overflow-y-auto pr-1 [scrollbar-width:none]",
            !history && "pointer-events-none",
          )}
        >
          {messages.map((m) => {
            const shown = history || now - m.at < VISIBLE_MS
            return (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: travel(motionMode, 6) }}
                animate={{ opacity: 1, y: 0 }}
                transition={enter}
                className={cn(
                  HUD_TEXT,
                  "w-fit max-w-full rounded-lg bg-hud-surface/85 px-3 py-1.5 text-sm leading-snug text-hud-foreground ring-1 ring-hud-border",
                  !shown && "hidden",
                )}
              >
                <span className="mr-1.5" style={{ color: readableColor(color(m.playerId)) }}>
                  {nickname(m.playerId)}
                </span>
                <span className="break-words">{m.text}</span>
              </motion.li>
            )
          })}
        </ul>
      </div>
      <div className="flex items-center justify-end gap-2">
        <form
          id={formId}
          onSubmit={send}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className={cn(
            HUD_TEXT,
            HUD_PANEL,
            "pointer-events-auto flex min-w-0 flex-1 items-center gap-1 rounded-full py-1 pr-1 pl-4 opacity-80 transition-opacity duration-fast ease-standard focus-within:opacity-100 hover:opacity-100 motion-reduce:transition-none",
            // the palette is a child of the row: dimmed with it, the messages behind would show through
            board && "opacity-100",
            !open && "short:hidden",
          )}
        >
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setActive(true)}
            onBlur={() => setActive(false)}
            maxLength={CHAT_MAX_LENGTH}
            placeholder={t("chatPlaceholder")}
            aria-label={t("chatPlaceholder")}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-hud-foreground outline-none placeholder:text-hud-muted"
          />
          <div ref={boardRef} className="relative">
            <AnimatePresence>
              {board && (
                <motion.div
                  initial={{ opacity: 0, y: travel(motionMode, 6) }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: travel(motionMode, 6) }}
                  transition={{ duration: fade(motionMode, 0.15), ease: EASE_STANDARD }}
                  className="absolute right-0 bottom-full mb-2 grid w-44 grid-cols-4 gap-1 rounded-xl bg-hud-surface p-2 shadow-overlay ring-1 ring-hud-border"
                >
                  {reactions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      title={reactionLabel(r, t)}
                      aria-label={reactionLabel(r, t)}
                      onClick={() => react(r)}
                      className={cn(
                        HUD_TRANSITION,
                        "flex size-9 cursor-pointer items-center justify-center rounded-lg text-xl outline-none hover:bg-hud-foreground/10 focus-visible:ring-2 focus-visible:ring-hud-foreground/70",
                      )}
                    >
                      {r.emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              aria-label={t("chatReactions")}
              aria-expanded={board}
              title={t("chatReactions")}
              onClick={() => {
                prepareSoundboard()
                setBoard((b) => !b)
              }}
              className={cn(
                HUD_TRANSITION,
                "flex size-8 cursor-pointer items-center justify-center rounded-full text-hud-foreground outline-none hover:bg-hud-foreground/10 focus-visible:ring-2 focus-visible:ring-hud-foreground/70",
                board && "bg-hud-foreground/15",
              )}
            >
              <SmilePlusIcon aria-hidden className="size-4.5" strokeWidth={1.8} />
            </button>
          </div>
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label={t("chatSend")}
            title={t("chatSend")}
            className={cn(
              HUD_TRANSITION,
              "flex size-8 cursor-pointer items-center justify-center rounded-full text-hud-foreground outline-none hover:bg-hud-foreground/10 focus-visible:ring-2 focus-visible:ring-hud-foreground/70 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent",
            )}
          >
            <HugeiconsIcon icon={Sent02Icon} strokeWidth={1.8} className="size-4.5" />
          </button>
        </form>
        <button
          type="button"
          data-hud="chat-toggle"
          aria-label={t("chat")}
          aria-expanded={open}
          aria-controls={formId}
          title={t("chat")}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            HUD_PANEL,
            HUD_TRANSITION,
            "pointer-events-auto hidden size-10 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-hud-raised focus-visible:ring-2 focus-visible:ring-hud-foreground/70 short:flex",
          )}
        >
          {open ? <XIcon aria-hidden className="size-4.5" strokeWidth={1.8} /> : <MessageCircleIcon aria-hidden className="size-4.5" strokeWidth={1.8} />}
        </button>
      </div>
    </div>
  )
}
