"use client"

import { Loader2Icon, MessageSquareIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@pgo/ui/game/dialog"
import { cn } from "@pgo/ui/utils"
import { useProfile } from "../lib/profile"
import { useSkin, useText } from "./skin-provider"
import { ICON_BUTTON } from "./sound/sound"

/** Bouton « Donner votre avis » : message libre envoyé à l'admin (Tasks › Feedback). */
export function FeedbackButton({ gameCode, className }: { gameCode?: string; className?: string }) {
  const t = useText()
  const { errors } = useSkin()
  const { profile } = useProfile()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, nickname: profile.nickname || null, gameCode: gameCode ?? null, page: window.location.pathname }),
      })
      if (!res.ok) throw new Error(errors.SERVER_ERROR ?? "Une erreur est survenue.")
      toast.success(t("feedbackThanks"))
      setMessage("")
      setOpen(false)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label={t("feedbackButton")} title={t("feedbackButton")} className={cn(ICON_BUTTON, className)}>
          <MessageSquareIcon strokeWidth={1.6} className="size-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,30rem)] rounded-2xl border-0 bg-surface p-6 text-foreground">
        <DialogTitle className="font-display text-2xl">{t("feedbackTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("feedbackButton")}</DialogDescription>
        <form onSubmit={send} className="flex flex-col gap-4">
          <textarea
            autoFocus
            value={message}
            maxLength={2000}
            rows={5}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("feedbackPlaceholder")}
            className="w-full resize-none rounded-xl border border-foreground/20 bg-surface-dark/80 p-3 text-base outline-none placeholder:text-foreground/40 focus:border-foreground/60"
          />
          <button
            type="submit"
            disabled={!message.trim() || sending}
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground font-display text-lg text-background transition-transform hover:scale-[1.02] disabled:cursor-default disabled:opacity-50 disabled:hover:scale-100"
          >
            {sending && <Loader2Icon className="size-4 animate-spin" />}
            {t("feedbackSend")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
