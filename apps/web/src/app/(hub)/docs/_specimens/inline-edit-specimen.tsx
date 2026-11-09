"use client"

import { useState } from "react"
import { InlineEdit, InlineField, InlineFieldInput, InlineFieldSelectTrigger } from "@pbgo/ui/platform/inline-edit"
import { Select, SelectContent, SelectItem, SelectValue } from "@pbgo/ui/platform/select"

const MAX = 20

/** An `InlineEdit` row that really edits: a username with the characters that are left. It keeps what it saved as long as the page is open, and takes a moment to save, so that the spinner and the closed button can be seen. */
export function InlineEditSpecimen() {
  const [saved, setSaved] = useState("Marly")
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(saved)
  const [pending, setPending] = useState(false)
  const text = value.trim().replace(/\s+/g, " ")
  const left = MAX - Array.from(text).length
  const problem = text === "" ? "Enter a username." : left < 0 ? `Use ${MAX} characters at most.` : null

  function save() {
    setPending(true)
    window.setTimeout(() => {
      setSaved(text)
      setPending(false)
      setOpen(false)
    }, 600)
  }

  return (
    <InlineEdit
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setValue(saved)
      }}
      title="Username"
      value={saved}
      editLabel="Edit username"
      canSave={problem === null && text !== saved}
      pending={pending}
      onSave={save}
    >
      <InlineField
        label="Username"
        htmlFor="specimen-username"
        aside={
          <>
            <span className={left < 0 ? "text-destructive" : undefined}>{left}</span>
            <span className="sr-only"> characters left</span>
          </>
        }
        error={problem}
      >
        <InlineFieldInput id="specimen-username" value={value} onChange={(event) => setValue(event.target.value)} maxLength={MAX * 2} disabled={pending} aria-invalid={problem ? true : undefined} aria-describedby={problem ? "specimen-username-error" : undefined} />
      </InlineField>
    </InlineEdit>
  )
}

/** The fields of an open row, each as a field of its own: one input with a note, one with a mistake, a select, and several controls on one surface. */
export function InlineFieldsSpecimen() {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <InlineField label="Username" htmlFor="specimen-field-input" aside="14">
        <InlineFieldInput id="specimen-field-input" defaultValue="Marly" />
      </InlineField>
      <InlineField label="Username" htmlFor="specimen-field-invalid" aside={<span className="text-destructive">-3</span>} error="Use 20 characters at most.">
        <InlineFieldInput id="specimen-field-invalid" defaultValue="Marly Marly Marly Marly" aria-invalid aria-describedby="specimen-field-invalid-error" />
      </InlineField>
      <InlineField label="Country / region" htmlFor="specimen-field-select">
        <Select defaultValue="fr">
          <InlineFieldSelectTrigger id="specimen-field-select">
            <SelectValue />
          </InlineFieldSelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value="fr">France</SelectItem>
            <SelectItem value="de">Germany</SelectItem>
            <SelectItem value="it">Italy</SelectItem>
          </SelectContent>
        </Select>
      </InlineField>
      <InlineField label="Date of birth" htmlFor="specimen-field-day">
        <div role="group" aria-label="Date of birth" className="flex items-center gap-3">
          <InlineFieldInput id="specimen-field-day" aria-label="Day" placeholder="DD" inputMode="numeric" className="w-9" defaultValue="18" />
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <InlineFieldInput aria-label="Month" placeholder="MM" inputMode="numeric" className="w-9" defaultValue="6" />
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <InlineFieldInput aria-label="Year" placeholder="YYYY" inputMode="numeric" className="w-14" defaultValue="1994" />
        </div>
      </InlineField>
    </div>
  )
}
