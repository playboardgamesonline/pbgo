"use client"

import { Archive01Icon, Bug01Icon, Delete02Icon, MailOpen01Icon, Message01Icon, TaskDone01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@pbgo/ui/admin/alert"
import { Badge } from "@pbgo/ui/admin/badge"
import { Button } from "@pbgo/ui/admin/button"
import { Card, CardContent } from "@pbgo/ui/admin/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/admin/empty"
import { Skeleton } from "@pbgo/ui/admin/skeleton"
import { cn } from "@pbgo/ui/utils"
import { adminRequest, AdminApiError } from "../../../lib/admin-api"
import type { Feedback } from "../../../server/tasks"

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
const TYPE_LABEL: Record<Feedback["type"], string> = { review: "Review", bug: "Bug report", suggestion: "Suggestion", other: "Other" }
const TABS: { id: Feedback["status"]; label: string }[] = [
  { id: "new", label: "New" },
  { id: "read", label: "Read" },
  { id: "archived", label: "Archived" },
]

export function FeedbackList() {
  const [items, setItems] = useState<Feedback[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [tab, setTab] = useState<Feedback["status"]>("new")

  const load = useCallback(async () => {
    try {
      setItems(await adminRequest<Feedback[]>("/api/feedback"))
    } catch (e) {
      if (e instanceof AdminApiError && e.code === "MIGRATION_MISSING") setMissing(true)
      else toast.error((e as Error).message)
      setItems([])
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
    window.addEventListener("focus", load)
    return () => window.removeEventListener("focus", load)
  }, [load])

  async function setStatus(id: string, status: Feedback["status"]) {
    setItems((l) => l?.map((f) => (f.id === id ? { ...f, status } : f)) ?? null)
    await adminRequest("/api/feedback", { method: "PATCH", body: JSON.stringify({ id, status }) }).catch((e) => toast.error((e as Error).message))
  }

  async function remove(id: string) {
    setItems((l) => l?.filter((f) => f.id !== id) ?? null)
    await adminRequest(`/api/feedback?id=${id}`, { method: "DELETE" }).catch((e) => toast.error((e as Error).message))
  }

  async function toTask(f: Feedback, type: "bug" | "backlog") {
    try {
      await adminRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ text: f.message.slice(0, 300), type: type, category: type === "bug" ? "Bugs" : "Feedback", priority: "medium" }),
      })
      await setStatus(f.id, "archived")
      toast.success(type === "bug" ? "Added to Bugs" : "Added to the Backlog")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const shown = (items ?? []).filter((f) => f.status === tab)
  const count = (s: Feedback["status"]) => (items ?? []).filter((f) => f.status === s).length

  if (missing)
    return (
      <Alert>
        <AlertTitle>Supabase migration missing</AlertTitle>
        <AlertDescription>
          Apply <code>supabase/migrations/…_admin_tasks_feedback.sql</code> to create the feedback table. The feedback button of the game needs it too.
        </AlertDescription>
      </Alert>
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground",
              tab === t.id && "bg-background font-medium text-foreground shadow-xs",
            )}
          >
            {t.label}
            <span className="text-xs tabular-nums text-muted-foreground">{count(t.id)}</span>
          </button>
        ))}
      </div>
      {items === null ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Message01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>{tab === "new" ? "Nothing new" : "Empty"}</EmptyTitle>
            <EmptyDescription>Players send feedback with the paper-plane button, next to the rules and sound buttons.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        shown.map((f) => (
          <Card key={f.id} className="group gap-3 py-4">
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed whitespace-pre-line">{f.message}</p>
              {f.screenshot_url && (
                <a href={f.screenshot_url} target="_blank" rel="noopener noreferrer" className="w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.screenshot_url} alt="Screenshot sent by the player" loading="lazy" referrerPolicy="no-referrer" className="max-h-40 rounded-lg border" />
                </a>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{DATE.format(new Date(f.created_at))}</span>
                <Badge variant={f.type === "bug" ? "destructive" : "secondary"}>{TYPE_LABEL[f.type] ?? f.type}</Badge>
                {f.nickname && <Badge variant="outline">{f.nickname}</Badge>}
                {f.email && (
                  <a href={`mailto:${encodeURIComponent(f.email).replace(/%40/g, "@")}`} className="underline underline-offset-2 hover:text-foreground">
                    {f.email}
                  </a>
                )}
                {f.game_code && <Badge variant="outline" className="font-mono">{f.game_code}</Badge>}
                {f.page && <span className="font-mono">{f.page}</span>}
                <span className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toTask(f, "bug")}>
                    <HugeiconsIcon icon={Bug01Icon} strokeWidth={2} data-icon="inline-start" />
                    Bug
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toTask(f, "backlog")}>
                    <HugeiconsIcon icon={TaskDone01Icon} strokeWidth={2} data-icon="inline-start" />
                    Backlog
                  </Button>
                  {f.status === "new" && (
                    <Button variant="ghost" size="sm" onClick={() => setStatus(f.id, "read")}>
                      <HugeiconsIcon icon={MailOpen01Icon} strokeWidth={2} data-icon="inline-start" />
                      Mark read
                    </Button>
                  )}
                  {f.status !== "archived" ? (
                    <Button variant="ghost" size="icon-sm" aria-label="Archive" title="Archive" onClick={() => setStatus(f.id, "archived")}>
                      <HugeiconsIcon icon={Archive01Icon} strokeWidth={2} />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon-sm" aria-label="Delete" title="Delete" onClick={() => remove(f.id)}>
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                    </Button>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
