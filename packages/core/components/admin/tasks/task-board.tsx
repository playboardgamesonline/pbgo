"use client"

import { Add01Icon, Bug01Icon, Delete02Icon, TaskDone01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@pgo/ui/admin/alert"
import { Badge } from "@pgo/ui/admin/badge"
import { Button } from "@pgo/ui/admin/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@pgo/ui/admin/card"
import { Checkbox } from "@pgo/ui/admin/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pgo/ui/admin/empty"
import { Input } from "@pgo/ui/admin/input"
import { Label } from "@pgo/ui/admin/label"
import { Progress } from "@pgo/ui/admin/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pgo/ui/admin/select"
import { Skeleton } from "@pgo/ui/admin/skeleton"
import { Switch } from "@pgo/ui/admin/switch"
import { cn } from "@pgo/ui/utils"
import { adminRequest } from "../../../lib/admin-api"
import type { Task, TaskPriority, TaskType } from "../../../server/tasks"

export const PRIORITY: Record<TaskPriority, { label: string; bug: string; className: string }> = {
  high: { label: "High", bug: "Critical", className: "bg-red-500/10 text-red-700 ring-red-500/20" },
  medium: { label: "Medium", bug: "Major", className: "bg-amber-500/10 text-amber-700 ring-amber-500/20" },
  low: { label: "Low", bug: "Minor", className: "bg-muted text-muted-foreground ring-border" },
}
const ORDER: TaskPriority[] = ["high", "medium", "low"]

/** Backlog (par catégorie) ou Bugs (par gravité). */
export function TaskBoard({ type }: { type: TaskType }) {
  const bug = type === "bug"
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [migrated, setMigrated] = useState(true)
  const [text, setText] = useState("")
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState<TaskPriority>(bug ? "medium" : "medium")
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await adminRequest<{ tasks: Task[]; migrated: boolean }>(`/api/tasks?type=${type}`)
      setTasks(res.tasks)
      setMigrated(res.migrated)
    } catch {
      toast.error("Could not load the tasks (is the “tasks” table created?)")
      setTasks([])
    }
  }, [type])

  useEffect(() => {
    void Promise.resolve().then(load)
    window.addEventListener("focus", load)
    return () => window.removeEventListener("focus", load)
  }, [load])

  const label = (p: TaskPriority) => (bug ? PRIORITY[p].bug : PRIORITY[p].label)
  const categories = useMemo(() => [...new Set((tasks ?? []).map((t) => t.category))], [tasks])
  const groups = useMemo(() => {
    const all = tasks ?? []
    const keys = bug ? ORDER : categories
    return keys.map((key) => {
      const items = all.filter((t) => (bug ? t.priority === key : t.category === key))
      return {
        key,
        title: bug ? label(key as TaskPriority) : key,
        tasks: items
          .filter((t) => showDone || !t.done)
          .sort((a, b) => Number(a.done) - Number(b.done) || ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority) || a.sort_order - b.sort_order),
        total: items.length,
        done: items.filter((t) => t.done).length,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, categories, showDone, bug])
  const total = tasks?.length ?? 0
  const done = tasks?.filter((t) => t.done).length ?? 0

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const task = await adminRequest<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ text, category: bug ? "Bugs" : category || categories[0], type, priority }),
      })
      setTasks((l) => [...(l ?? []), task])
      setText("")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function update(id: string, patch: Partial<Task>) {
    const before = tasks
    setTasks((l) => l?.map((t) => (t.id === id ? { ...t, ...patch } : t)) ?? null)
    try {
      await adminRequest(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
      if (patch.type && patch.type !== type) setTasks((l) => l?.filter((t) => t.id !== id) ?? null)
    } catch (err) {
      setTasks(before)
      toast.error((err as Error).message)
    }
  }

  async function remove(id: string) {
    const before = tasks
    setTasks((l) => l?.filter((t) => t.id !== id) ?? null)
    try {
      await adminRequest(`/api/tasks/${id}`, { method: "DELETE" })
    } catch {
      setTasks(before)
      toast.error("Could not delete")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!migrated && (
        <Alert>
          <AlertTitle>Supabase migration missing</AlertTitle>
          <AlertDescription>
            Apply <code>supabase/migrations/…_admin_tasks_feedback.sql</code> to enable {bug ? "bugs" : "priorities and bugs"}. Until then every task is in the Backlog.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{bug ? "Open bugs" : "Progress"}</CardTitle>
          <CardDescription>
            {bug ? `${total - done} open · ${done} fixed` : `${done} of ${total} task${total > 1 ? "s" : ""} done`}
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Switch id="show-done" checked={showDone} onCheckedChange={setShowDone} />
              <Label htmlFor="show-done">Show {bug ? "fixed" : "done"}</Label>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!bug && <Progress value={total ? (done / total) * 100 : 0} />}
          <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={bug ? "Describe the bug…" : "New task…"} className="flex-1" disabled={bug && !migrated} />
            {!bug && (
              <>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} list="task-categories" placeholder={categories[0] ?? "Category"} className="sm:w-44" />
                <datalist id="task-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)} disabled={!migrated}>
              <SelectTrigger className="sm:w-32" aria-label={bug ? "Severity" : "Priority"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {label(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={!text.trim() || (bug && !migrated)}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {tasks === null ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={bug ? Bug01Icon : TaskDone01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>{bug ? "No bugs" : "No tasks"}</EmptyTitle>
            <EmptyDescription>{bug ? "Nothing reported. Player feedback can be turned into bugs." : "Add the first step of the project above."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className={cn("grid gap-6", !bug && "md:grid-cols-2")}>
          {groups
            .filter((g) => g.total > 0)
            .map((g) => (
              <Card key={g.key} className="gap-0 py-0">
                <CardHeader className="border-b py-4">
                  <CardTitle className="text-sm">{g.title}</CardTitle>
                  <CardAction>
                    <Badge variant={g.done === g.total ? "default" : "secondary"} className="tabular-nums">
                      {bug ? g.total - g.done : `${g.done}/${g.total}`}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="px-0">
                  <ul className="divide-y">
                    {g.tasks.map((t) => (
                      <li key={t.id} className="group flex items-start gap-3 px-6 py-3">
                        <Checkbox className="mt-0.5" checked={t.done} onCheckedChange={(v) => update(t.id, { done: v === true })} aria-label={t.done ? "Mark as open" : "Mark as done"} />
                        <EditableText value={t.text} done={t.done} onConfirm={(value) => update(t.id, { text: value })} />
                        {!bug && migrated && (
                          <button
                            type="button"
                            title="Change priority"
                            onClick={() => update(t.id, { priority: ORDER[(ORDER.indexOf(t.priority) + 1) % 3]! })}
                            className={cn("cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", PRIORITY[t.priority].className)}
                          >
                            {PRIORITY[t.priority].label}
                          </button>
                        )}
                        {bug && (
                          <Select value={t.priority} onValueChange={(v) => update(t.id, { priority: v as TaskPriority })}>
                            <SelectTrigger size="sm" className="h-6 w-24 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Severity">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {PRIORITY[p].bug}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button variant="ghost" size="icon-xs" aria-label="Delete" onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        </Button>
                      </li>
                    ))}
                    {g.tasks.length === 0 && <li className="px-6 py-3 text-sm text-muted-foreground">{bug ? "All fixed here." : "All done here."}</li>}
                  </ul>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}

function EditableText({ value, done, onConfirm }: { value: string; done: boolean; onConfirm: (text: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null)
  if (editing !== null)
    return (
      <Input
        autoFocus
        value={editing}
        onChange={(e) => setEditing(e.target.value)}
        onBlur={() => {
          if (editing.trim() && editing !== value) onConfirm(editing.trim())
          setEditing(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setEditing(null)
        }}
        className="-my-1.5 h-8 flex-1"
      />
    )
  return (
    <span onDoubleClick={() => setEditing(value)} className={cn("min-w-0 flex-1 cursor-text text-sm leading-5", done && "text-muted-foreground line-through")} title="Double-click to edit">
      {value}
    </span>
  )
}
