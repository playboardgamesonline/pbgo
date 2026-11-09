"use client"

import * as React from "react"
import { Edit02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"
import { Input } from "./input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "./item"
import { Label } from "./label"
import { SelectTrigger } from "./select"
import { Spinner } from "./spinner"

/** What the controls of a field take off themselves, since the field is their surface: their own fill, outline, ring, height and room. `cn` merges it over the control's own classes, so none of them is fought with a selector. */
const BARE_CONTROL = "h-auto rounded-none border-0 bg-transparent p-0 shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0"

/** The controls inside a field that can be focused, first in the order of the page: where the cursor goes when the row opens. */
const FIRST_CONTROL = '[data-slot="inline-field"] :is(input, textarea, select, button[role="combobox"]):not(:disabled)'

/** Puts the cursor in the first control of a row that has just opened: at the end of what it holds, or, for a control that says `data-autoselect` (a number of a few digits, which is typed over and not added to), with all of it selected. */
function focusFirstControl(root: HTMLElement | null) {
  const control = root?.querySelector<HTMLElement>(FIRST_CONTROL)
  if (!control) return
  control.focus()
  if (!(control instanceof HTMLInputElement) || control.type !== "text") return
  if (control.hasAttribute("data-autoselect")) control.select()
  else control.setSelectionRange(control.value.length, control.value.length)
}

/**
 * A row of a list that is edited where it stands: it says what it holds and has an edit button; the button turns the row into its form, fields and two buttons, and Save or Cancel turns it back. No window opens. The caller holds the state
 * (`open`, the draft, `pending`, `error`) and gives the fields as children, each an `InlineField`. Save is off until `canSave`, Enter in a field saves, Escape cancels, the cursor goes to the first field when the row opens and back to the edit
 * button when it closes (or to the first field again when a save failed), and a save in flight shows a spinner and cannot be pressed twice.
 */
function InlineEdit({
  open,
  onOpenChange,
  title,
  value,
  editLabel,
  saveLabel = "Save changes",
  cancelLabel = "Cancel",
  canSave,
  pending = false,
  error = null,
  onSave,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What the row is, as its title says it when it is closed. */
  title: React.ReactNode
  /** What the row holds, under its title, when it is closed. */
  value: React.ReactNode
  /** The accessible name of the edit button, which has an icon and no text ("Edit username"); the open form is named with it too. */
  editLabel: string
  saveLabel?: string
  cancelLabel?: string
  /** Whether what is typed can be saved: valid, and not what the row holds already. */
  canSave: boolean
  /** A save is on its way: nothing can be pressed twice. */
  pending?: boolean
  /** Why the save failed, under the fields; a mistake in one field belongs to that `InlineField`. */
  error?: string | null
  onSave: () => void
  className?: string
  /** The fields, drawn while the row is open. */
  children: React.ReactNode
}) {
  const form = React.useRef<HTMLFormElement>(null)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const wasOpen = React.useRef(false)
  const wasPending = React.useRef(false)

  // The cursor follows the row: into its first field when it opens, back to the edit button when it closes
  React.useEffect(() => {
    if (open) focusFirstControl(form.current)
    else if (wasOpen.current) trigger.current?.focus()
    wasOpen.current = open
  }, [open])

  // A save that failed leaves the row open and its fields enabled again: the cursor goes back into them
  React.useEffect(() => {
    if (open && wasPending.current && !pending) focusFirstControl(form.current)
    wasPending.current = pending
  }, [open, pending])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSave && !pending) onSave()
  }

  function keyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape" || event.defaultPrevented || pending) return
    // A menu that a field opened (a select) lives outside the form: its own Escape closes it, and the row stays open
    if (!event.currentTarget.contains(event.target as Node)) return
    event.preventDefault()
    onOpenChange(false)
  }

  return (
    <Item data-state={open ? "open" : "closed"} className={className}>
      {open ? (
        <form ref={form} aria-label={editLabel} aria-busy={pending} noValidate onSubmit={submit} onKeyDown={keyDown} className="flex w-full flex-col gap-3 animate-in fade-in-0 duration-fast">
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={!canSave || pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {saveLabel}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <ItemContent>
            <ItemTitle>{title}</ItemTitle>
            <ItemDescription>{value}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button ref={trigger} type="button" variant="outline" size="icon" aria-label={editLabel} onClick={() => onOpenChange(true)}>
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
            </Button>
          </ItemActions>
        </>
      )}
    </Item>
  )
}

/**
 * The surface of one thing typed in a row that is open: its name small above, what is typed under it, and, at the top right, a note such as the characters that are left (`aside`). The field takes its focus ring and its error colour for the
 * whole surface, and what it says is wrong goes under it (`error`, with the id `<htmlFor>-error` for the control's `aria-describedby`). The controls inside wear no surface of their own: `InlineFieldInput` and `InlineFieldSelectTrigger`.
 */
function InlineField({
  label,
  htmlFor,
  aside,
  error,
  className,
  children,
}: {
  label: React.ReactNode
  /** The id of the control that the label names: the first one, when a field holds several. */
  htmlFor: string
  aside?: React.ReactNode
  error?: string | null
  className?: string
  children: React.ReactNode
}) {
  return (
    <div data-slot="inline-field-group" className="flex flex-col gap-1.5">
      <div
        data-slot="inline-field"
        data-invalid={error ? true : undefined}
        className={cn(
          "flex flex-col gap-1 rounded-xl border border-transparent bg-input/50 px-3 pt-2 pb-2.5 transition-[color,box-shadow,background-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 data-[invalid=true]:border-destructive/50 data-[invalid=true]:ring-3 data-[invalid=true]:ring-destructive/40",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
            {label}
          </Label>
          {aside != null && <span className="text-xs tabular-nums text-muted-foreground">{aside}</span>}
        </div>
        {children}
      </div>
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** An `Input` for inside an `InlineField`: the field is its surface, so it keeps none of its own. */
function InlineFieldInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn(BARE_CONTROL, className)} {...props} />
}

/** A `SelectTrigger` for inside an `InlineField`, across its whole width: the field is its surface. */
function InlineFieldSelectTrigger({ className, ...props }: React.ComponentProps<typeof SelectTrigger>) {
  return <SelectTrigger className={cn(BARE_CONTROL, "w-full data-[size=default]:h-auto", className)} {...props} />
}

export { InlineEdit, InlineField, InlineFieldInput, InlineFieldSelectTrigger }
