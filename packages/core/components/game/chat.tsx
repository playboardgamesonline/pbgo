"use client"

import { Sent02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@pbgo/ui/utils"
import { openChat, type ChatMessage } from "../../lib/realtime"
import { useText } from "../skin-provider"
import { useGame } from "./context"

const VISIBLE_MS = 9000
const KEEP = 40
const MAX_LENGTH = 240
const MIN_GAP_MS = 700

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
  const [, tick] = useState(0)
  const channel = useRef<ReturnType<typeof openChat> | null>(null)
  const last = useRef(0)
  const list = useRef<HTMLUListElement>(null)
  const meId = game.meId

  useEffect(() => {
    const c = openChat(game.code, (m) => setMessages((all) => [...all, m].slice(-KEEP)))
    channel.current = c
    return () => {
      c?.close()
      channel.current = null
    }
  }, [game.code])

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

  if (!meId) return null
  const now = Date.now()
  return (
    <div
      className={cn("pointer-events-none fixed right-5 bottom-5 z-30 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2", className)}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
    >
      <ul
        ref={list}
        aria-live="polite"
        aria-label={t("chat")}
        className={cn(
          "pointer-events-auto flex max-h-56 flex-col justify-end gap-1 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,transparent,black_28%)] [scrollbar-width:none]",
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
        <button type="submit" disabled={!text.trim()} aria-label={t("chatSend")} title={t("chatSend")} className="flex size-8 cursor-pointer items-center justify-center rounded-full text-foreground transition-opacity disabled:cursor-default disabled:opacity-30">
          <HugeiconsIcon icon={Sent02Icon} strokeWidth={1.8} className="size-4.5" />
        </button>
      </form>
    </div>
  )
}
