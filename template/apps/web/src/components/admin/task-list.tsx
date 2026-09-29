"use client"

import { Add01Icon, Delete02Icon, TaskDone01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@pgo/ui/admin/badge"
import { Button } from "@pgo/ui/admin/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@pgo/ui/admin/card"
import { Checkbox } from "@pgo/ui/admin/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pgo/ui/admin/empty"
import { Input } from "@pgo/ui/admin/input"
import { Label } from "@pgo/ui/admin/label"
import { Progress } from "@pgo/ui/admin/progress"
import { Skeleton } from "@pgo/ui/admin/skeleton"
import { Switch } from "@pgo/ui/admin/switch"
import { adminRequest } from "@/lib/admin-api"
import { cn } from "@/lib/utils"

type Task = { id: string; text: string; category: string; done: boolean; sort_order: number }

export function TaskList() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [text, setText] = useState("")
  const [category, setCategory] = useState("")
  const [showDone, setShowDone] = useState(true)

  const load = useCallback(async () => {
    try {
      setTasks(await adminRequest<Task[]>("/api/tasks"))
    } catch {
      toast.error("Impossible de charger la to-do (table « tasks » créée ?)")
      setTasks([])
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
    window.addEventListener("focus", load)
    return () => window.removeEventListener("focus", load)
  }, [load])

  const categories = useMemo(() => [...new Set((tasks ?? []).map((t) => t.category))], [tasks])
  const groups = useMemo(
    () =>
      categories.map((c) => {
        const all = (tasks ?? []).filter((t) => t.category === c)
        return {
          category: c,
          tasks: all.filter((t) => showDone || !t.done).sort((a, b) => Number(a.done) - Number(b.done) || a.sort_order - b.sort_order),
          total: all.length,
          done: all.filter((t) => t.done).length,
        }
      }),
    [categories, tasks, showDone],
  )
  const total = tasks?.length ?? 0
  const done = tasks?.filter((t) => t.done).length ?? 0

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const task = await adminRequest<Task>("/api/tasks", { method: "POST", body: JSON.stringify({ text, category: category || categories[0] }) })
      setTasks((l) => [...(l ?? []), task])
      setText("")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    const before = tasks
    setTasks((l) => l?.map((t) => (t.id === id ? { ...t, ...patch } : t)) ?? null)
    try {
      await adminRequest(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
    } catch {
      setTasks(before)
      toast.error("Modification impossible")
    }
  }

  async function remove(id: string) {
    const before = tasks
    setTasks((l) => l?.filter((t) => t.id !== id) ?? null)
    try {
      await adminRequest(`/api/tasks/${id}`, { method: "DELETE" })
    } catch {
      setTasks(before)
      toast.error("Suppression impossible")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Avancement</CardTitle>
          <CardDescription>
            {done} tâche{done > 1 ? "s" : ""} terminée{done > 1 ? "s" : ""} sur {total}
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Switch id="show-done" checked={showDone} onCheckedChange={setShowDone} />
              <Label htmlFor="show-done">Afficher les terminées</Label>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Progress value={total ? (done / total) * 100 : 0} />
          <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nouvelle tâche…" className="flex-1" />
            <Input value={category} onChange={(e) => setCategory(e.target.value)} list="task-categories" placeholder={categories[0] ?? "Catégorie"} className="sm:w-48" />
            <datalist id="task-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Button type="submit" disabled={!text.trim()}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              Ajouter
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
              <HugeiconsIcon icon={TaskDone01Icon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>Aucune tâche</EmptyTitle>
            <EmptyDescription>Ajoutez la première étape du projet ci-dessus.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.category} className="gap-0 py-0">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-sm">{g.category}</CardTitle>
                <CardAction>
                  <Badge variant={g.done === g.total ? "default" : "secondary"} className="tabular-nums">
                    {g.done}/{g.total}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                <ul className="divide-y">
                  {g.tasks.map((t) => (
                    <li key={t.id} className="group flex items-start gap-3 px-6 py-3">
                      <Checkbox className="mt-0.5" checked={t.done} onCheckedChange={(v) => updateTask(t.id, { done: v === true })} aria-label={t.done ? "Marquer à faire" : "Marquer faite"} />
                      <EditableText value={t.text} done={t.done} onConfirm={(value) => updateTask(t.id, { text: value })} />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Supprimer"
                        onClick={() => remove(t.id)}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      </Button>
                    </li>
                  ))}
                  {g.tasks.length === 0 && <li className="px-6 py-3 text-sm text-muted-foreground">Tout est fait ici.</li>}
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
    <span onDoubleClick={() => setEditing(value)} className={cn("min-w-0 flex-1 cursor-text text-sm leading-5", done && "text-muted-foreground line-through")} title="Double-clic pour modifier">
      {value}
    </span>
  )
}
