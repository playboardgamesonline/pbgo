"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { DISPLAY_NAME_MAX, checkNickname } from "@pbgo/accounts"
import { saveNickname } from "@pbgo/accounts/client"
import { Button } from "@pbgo/ui/platform/button"
import { Field, FieldError, FieldLabel } from "@pbgo/ui/platform/field"
import { Input } from "@pbgo/ui/platform/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { toast } from "@pbgo/ui/platform/sonner"
import { SettingsDialog } from "@/components/settings-dialog"
import { changing, failureOf } from "@/lib/settings-change"

/**
 * The Nickname row of the settings: the name the others see at a table, and a button that opens the window to change it. The name is kept in the account under a key of ours (`saveNickname`), so that the next sign-in with a provider
 * does not undo it; the next table the member sits at carries it, and the ones they already sit at keep the name they were opened with. The page is drawn again once it is saved.
 */
export function NicknameRow({ nickname, demo }: { nickname: string; demo: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(nickname)
  const [problem, setProblem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setValue(nickname)
      setProblem(null)
      setError(null)
    }
  }

  async function submit() {
    const checked = checkNickname(value)
    if (!checked.ok) {
      setProblem(checked.problem)
      return
    }
    setProblem(null)
    setError(null)
    setPending(true)
    const outcome = await changing(demo, () => saveNickname(checked.nickname))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setError(failure)
      return
    }
    setOpen(false)
    toast.success("Nickname saved")
    router.refresh()
  }

  return (
    <>
      <Item>
        <ItemContent>
          <ItemTitle>Nickname</ItemTitle>
          <ItemDescription className="ph-mask">{nickname}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" onClick={() => toggle(true)}>
            Edit
          </Button>
        </ItemActions>
      </Item>
      <SettingsDialog
        open={open}
        onOpenChange={toggle}
        title="Change your nickname"
        description="It is the name the other players see at a table."
        submitLabel="Save"
        pending={pending}
        error={error}
        onSubmit={submit}
      >
        <Field data-invalid={problem ? true : undefined}>
          <FieldLabel htmlFor="nickname-field">Nickname</FieldLabel>
          <Input
            id="nickname-field"
            className="ph-mask"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setProblem(null)
            }}
            maxLength={DISPLAY_NAME_MAX * 2}
            autoComplete="nickname"
            autoFocus
            disabled={pending}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "nickname-field-error" : undefined}
          />
          <FieldError id="nickname-field-error">{problem}</FieldError>
        </Field>
      </SettingsDialog>
    </>
  )
}
