"use client"

import { Sent02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@pbgo/ui/game/dialog"
import { cn } from "@pbgo/ui/utils"
import { ApiClientError } from "../lib/api"
import { isPreviewWindow } from "../lib/preview"
import { useProfile } from "../lib/profile"
import { useSkin, useText } from "./skin-provider"
import { ICON_BUTTON } from "./sound/sound"

const TYPES = [
  { value: "review", text: "feedbackTypeReview" },
  { value: "bug", text: "feedbackTypeBug" },
  { value: "suggestion", text: "feedbackTypeSuggestion" },
  { value: "other", text: "feedbackTypeOther" },
] as const
type FeedbackType = (typeof TYPES)[number]["value"]

const MAX_INPUT = 12 * 1024 * 1024
const FIELD =
  "w-full rounded-xl border border-foreground/20 bg-surface-dark/80 px-3 text-base outline-none placeholder:text-foreground/40 focus:border-foreground/60"

/** Réduit la capture (1600 px max) et la ré-encode côté navigateur : un envoi léger, quelle que soit la taille d'origine. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85))
  if (!blob) throw new Error("image")
  return new File([blob], "screenshot.webp", { type: "image/webp" })
}

/** Bouton « feedback » (hors jeu, séparé des boutons de partie) : type, message, e-mail et capture facultatifs → admin, Tasks › Feedback. */
export function FeedbackButton({ gameCode, className }: { gameCode?: string; className?: string }) {
  const t = useText()
  const { errors } = useSkin()
  const { profile } = useProfile()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>("review")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [trap, setTrap] = useState("")
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!screenshot) return setPreview(null)
    const url = URL.createObjectURL(screenshot)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [screenshot])

  async function pick(file: File | undefined) {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return toast.error(new ApiClientError("INVALID_IMAGE").message)
    if (file.size > MAX_INPUT) return toast.error(new ApiClientError("FILE_TOO_BIG").message)
    try {
      setScreenshot(await shrink(file))
    } catch {
      toast.error(new ApiClientError("INVALID_IMAGE").message)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending || isPreviewWindow()) return
    setSending(true)
    try {
      const body = new FormData()
      body.set("type", type)
      body.set("message", message)
      body.set("email", email)
      body.set("website", trap)
      body.set("nickname", profile.nickname || "")
      body.set("gameCode", gameCode ?? "")
      body.set("page", window.location.pathname)
      if (screenshot) body.set("screenshot", screenshot)
      const res = await fetch("/api/feedback", { method: "POST", body })
      if (!res.ok) throw new ApiClientError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "SERVER_ERROR")
      toast.success(t("feedbackThanks"))
      setMessage("")
      setEmail("")
      setScreenshot(null)
      setType("review")
      setOpen(false)
    } catch (err) {
      toast.error((err as Error).message ?? errors.SERVER_ERROR)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label={t("feedbackButton")} title={t("feedbackButton")} className={cn(ICON_BUTTON, className)}>
          <HugeiconsIcon icon={Sent02Icon} strokeWidth={1.6} className="size-7" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[min(92vw,30rem)] overflow-y-auto rounded-2xl border-0 bg-surface p-6 text-foreground">
        <DialogTitle className="font-display text-2xl">{t("feedbackTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("feedbackButton")}</DialogDescription>
        <form onSubmit={send} autoComplete="off" className="flex flex-col gap-3">
          <select
            aria-label={t("feedbackType")}
            value={type}
            onChange={(e) => setType(e.target.value as FeedbackType)}
            className={cn(FIELD, "h-12 cursor-pointer")}
          >
            {TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.text)}
              </option>
            ))}
          </select>
          <textarea
            autoFocus
            required
            value={message}
            maxLength={2000}
            rows={5}
            onChange={(e) => setMessage(e.target.value)}
            onPaste={(e) => {
              const image = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"))
              if (image) {
                e.preventDefault()
                void pick(image)
              }
            }}
            placeholder={t("feedbackPlaceholder")}
            className={cn(FIELD, "resize-none py-3")}
          />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("feedbackEmail")}
            className={cn(FIELD, "h-12")}
          />
          {/* Champ piège : invisible pour les humains, rempli par les robots */}
          <input
            tabIndex={-1}
            aria-hidden
            autoComplete="off"
            name="website"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          {preview ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="max-h-32 rounded-lg border border-foreground/20" />
              <button
                type="button"
                aria-label={t("feedbackScreenshotRemove")}
                title={t("feedbackScreenshotRemove")}
                onClick={() => setScreenshot(null)}
                className="absolute -top-2 -right-2 flex size-6 cursor-pointer items-center justify-center rounded-full bg-foreground text-background"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-foreground/70 hover:text-foreground">
              <ImagePlusIcon className="size-5" strokeWidth={1.6} />
              {t("feedbackScreenshotAdd")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  void pick(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
            </label>
          )}
          <button
            type="submit"
            disabled={!message.trim() || sending}
            className="mt-1 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground font-display text-lg text-background transition-transform hover:scale-[1.02] disabled:cursor-default disabled:opacity-50 disabled:hover:scale-100"
          >
            {sending && <Loader2Icon className="size-4 animate-spin" />}
            {t("feedbackSend")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
