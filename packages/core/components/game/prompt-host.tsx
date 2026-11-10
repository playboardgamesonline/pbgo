"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { type FormEvent, useState, useSyncExternalStore } from "react"
import { DEFAULT_TEXT_MAX } from "@pbgo/engine-kit"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@pbgo/ui/platform/dialog"
import { Input } from "@pbgo/ui/platform/input"
import { Textarea } from "@pbgo/ui/platform/textarea"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { cn } from "@pbgo/ui/utils"
import { ApiClientError } from "../../lib/api"
import { type Asking, answersOf, type ChoiceField, closePrompt, currentPrompt, type Draft, type NumberField, initialDraft, subscribePrompt, type TextField } from "./prompt"

/**
 * The window of `ask`, `askText`, `askNumber`, `askChoice` and `askChoices`, in the platform's look: a field for each thing asked, an error under the one that is not right, and the two buttons. Mount it once, anywhere in the page, as
 * `GameHud` does; it draws nothing until something is asked for.
 */
export function PromptHost() {
  const current = useSyncExternalStore(subscribePrompt, currentPrompt, () => null)
  // The window that was open stays drawn while it closes, so that it fades out instead of vanishing: the last prompt is kept, and kept again as soon as another is asked for
  const [last, setLast] = useState<Asking | null>(null)
  if (current && current !== last) setLast(current)
  const shown = current ?? last
  return <Window key={shown?.id ?? 0} asking={shown} open={!!current} />
}

const ERRORS = { text: "INVALID_TEXT", number: "INVALID_NUMBER", choice: "INVALID_CHOICE" } as const

function Window({ asking, open }: { asking: Asking | null; open: boolean }) {
  const prompt = asking?.prompt
  const fields = prompt?.fields ?? []
  const [draft, setDraft] = useState<Draft>(() => initialDraft(fields))
  const [invalid, setInvalid] = useState<readonly string[]>([])

  const set = (id: string, value: string | number[]) => {
    setDraft((current) => ({ ...current, [id]: value }))
    setInvalid((current) => current.filter((other) => other !== id))
  }
  const confirm = (given: Draft = draft) => {
    const result = answersOf(fields, given)
    if (result.ok) closePrompt(result.answers)
    else setInvalid(result.invalid)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    confirm()
  }
  const several = fields.length > 1

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closePrompt(null)}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle className="text-xl leading-tight">{prompt?.title}</DialogTitle>
            {prompt?.description ? <DialogDescription>{prompt.description}</DialogDescription> : <DialogDescription className="sr-only">{prompt?.title}</DialogDescription>}
          </DialogHeader>
          <div className={cn("flex flex-col", several ? "gap-6" : "gap-2")}>
            {fields.map((field, index) => {
              const name = field.label ?? prompt?.title ?? ""
              const wrong = invalid.includes(field.id)
              return (
                <div key={field.id} className="flex flex-col gap-2">
                  {field.label && several ? <span className="text-sm font-medium">{field.label}</span> : null}
                  {field.kind === "text" ? (
                    <TextView field={field} name={name} value={draft[field.id] as string} wrong={wrong} first={index === 0} onChange={(value) => set(field.id, value)} onConfirm={() => confirm()} />
                  ) : field.kind === "number" ? (
                    <NumberView field={field} name={name} value={draft[field.id] as string} wrong={wrong} first={index === 0} onChange={(value) => set(field.id, value)} />
                  ) : (
                    <ChoiceView
                      field={field}
                      name={name}
                      picked={draft[field.id] as number[]}
                      onChange={(picked) => set(field.id, picked)}
                      onInstant={prompt?.instant && !field.many ? (picked) => confirm({ ...draft, [field.id]: picked }) : undefined}
                    />
                  )}
                  <span role="alert" className="min-h-5 text-sm text-destructive">
                    {wrong ? new ApiClientError(ERRORS[field.kind]).message : null}
                  </span>
                </div>
              )
            })}
          </div>
          {prompt?.instant ? null : (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => closePrompt(null)}>
                {prompt?.cancel ?? "Cancel"}
              </Button>
              <Button type="submit">{prompt?.confirm ?? "OK"}</Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TextView({ field, name, value, wrong, first, onChange, onConfirm }: { field: TextField; name: string; value: string; wrong: boolean; first: boolean; onChange: (value: string) => void; onConfirm: () => void }) {
  const max = field.rules?.max ?? DEFAULT_TEXT_MAX
  const lines = field.rules?.lines ?? 1
  const characters = [...value].length
  return (
    <>
      {lines === 1 ? (
        <Input autoFocus={first} value={value} maxLength={max} placeholder={field.placeholder} aria-label={name} aria-invalid={wrong} enterKeyHint="done" autoComplete="off" onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Textarea
          autoFocus={first}
          value={value}
          maxLength={max}
          rows={lines}
          placeholder={field.placeholder}
          aria-label={name}
          aria-invalid={wrong}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              onConfirm()
            }
          }}
        />
      )}
      <span className="-mt-1 text-right text-sm text-muted-foreground tabular-nums">
        {characters}/{max}
      </span>
    </>
  )
}

/** The least and the most are the field's, and the number moves by its step, snapped to the steps counted from the least */
function nudged(field: NumberField, typed: string, direction: 1 | -1): string {
  const step = field.step ?? 1
  const current = typed.trim() === "" || !Number.isFinite(Number(typed)) ? field.min : Number(typed)
  const next = Math.min(field.max, Math.max(field.min, field.min + Math.round((current + direction * step - field.min) / step) * step))
  return String(Number(next.toFixed(10)))
}

function NumberView({ field, name, value, wrong, first, onChange }: { field: NumberField; name: string; value: string; wrong: boolean; first: boolean; onChange: (value: string) => void }) {
  const typed = Number(value)
  const known = value.trim() !== "" && Number.isFinite(typed)
  return (
    <>
      <div className="flex items-center justify-center gap-3">
        {/* The buttons are for the pointer: the field beside them is the control, and the arrow keys move it by a step */}
        <Button type="button" variant="outline" size="icon-lg" tabIndex={-1} aria-hidden disabled={known && typed <= field.min} onClick={() => onChange(nudged(field, value, -1))}>
          <MinusIcon />
        </Button>
        <Input
          autoFocus={first}
          type="number"
          inputMode={field.step === undefined || Number.isInteger(field.step) ? "numeric" : "decimal"}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={value}
          aria-label={name}
          aria-invalid={wrong}
          enterKeyHint="done"
          className="h-12 w-28 text-center text-2xl tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button type="button" variant="outline" size="icon-lg" tabIndex={-1} aria-hidden disabled={known && typed >= field.max} onClick={() => onChange(nudged(field, value, 1))}>
          <PlusIcon />
        </Button>
      </div>
      <span className="text-center text-sm text-muted-foreground tabular-nums">
        {field.min}–{field.max}
      </span>
    </>
  )
}

function ChoiceView({ field, name, picked, onChange, onInstant }: { field: ChoiceField; name: string; picked: number[]; onChange: (picked: number[]) => void; onInstant?: (picked: number[]) => void }) {
  // Options that are only a few words sit side by side; options with a line under them or a picture are rows
  const compact = field.options.every((option) => !option.description && !option.image)
  const most = field.many?.max
  const items = field.options.map((option, index) => (
    <ToggleGroupItem
      key={index}
      value={String(index)}
      disabled={option.disabled}
      className={cn(compact ? "h-10" : "h-auto min-h-10 w-full justify-start gap-3 py-2 text-left whitespace-normal")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the picture of an option is the game's own, served by its media proxy: the window cannot know its size for next/image */}
      {option.image ? <img src={option.image} alt="" className="size-8 shrink-0 rounded-md object-cover" /> : null}
      {compact ? (
        option.label
      ) : (
        <span className="flex min-w-0 flex-col">
          <span>{option.label}</span>
          {option.description ? <span className="text-xs opacity-70">{option.description}</span> : null}
        </span>
      )}
    </ToggleGroupItem>
  ))
  const className = cn("w-full", compact ? "grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2" : "flex flex-col gap-2")
  return (
    <>
      {field.many ? (
        <ToggleGroup type="multiple" aria-label={name} className={className} value={picked.map(String)} onValueChange={(next) => onChange(next.map(Number))}>
          {items}
        </ToggleGroup>
      ) : (
        <ToggleGroup
          type="single"
          aria-label={name}
          className={className}
          value={picked[0] === undefined ? "" : String(picked[0])}
          onValueChange={(next) => {
            const chosen = next === "" ? [] : [Number(next)]
            onChange(chosen)
            if (chosen.length > 0) onInstant?.(chosen)
          }}
        >
          {items}
        </ToggleGroup>
      )}
      {most !== undefined ? (
        <span className="-mt-1 text-right text-sm text-muted-foreground tabular-nums">
          {picked.length}/{most}
        </span>
      ) : null}
    </>
  )
}
