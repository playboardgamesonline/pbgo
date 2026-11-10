"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { DISPLAY_NAME_MAX, checkNickname, nicknameCharactersLeft } from "@pbgo/accounts"
import { saveNickname } from "@pbgo/accounts/client"
import { InlineEdit, InlineField, InlineFieldInput } from "@pbgo/ui/platform/inline-edit"
import { toast } from "@pbgo/ui/platform/sonner"
import { changing, failureOf } from "@/lib/settings-change"

/**
 * The Username row of the settings: the name the others see at a table, edited where it stands (`InlineEdit`: the edit button turns the row into its field, with the characters that are left, and Save changes). What the member sees is called a
 * username; the code keeps the older word (`Account.nickname`, `saveNickname`, the key `pbgo_nickname`), which names the same thing. The name is kept in the account under a key of ours (`saveNickname`), so that the next sign-in with a provider does
 * not undo it; the next table the member sits at carries it, and the ones they already sit at keep the name they were opened with. The row holds the name it saved, and the page is drawn again so that the rest of the site shows it.
 */
export function NicknameRow({ nickname, demo }: { nickname: string; demo: boolean }) {
  const router = useRouter()
  const [saved, setSaved] = useState(nickname)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(nickname)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const checked = checkNickname(value)
  // The field starts out as what the row holds, which is right: a mistake can only be one the member typed
  const problem = checked.ok ? null : checked.problem
  const left = nicknameCharactersLeft(value)

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setValue(saved)
      setError(null)
    }
  }

  async function submit() {
    if (!checked.ok) return
    setError(null)
    setPending(true)
    const outcome = await changing(demo, () => saveNickname(checked.nickname))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) {
      setError(failure)
      return
    }
    setSaved(checked.nickname)
    setOpen(false)
    toast.success("Username saved")
    router.refresh()
  }

  return (
    <InlineEdit
      open={open}
      onOpenChange={toggle}
      title="Username"
      value={<span className="ph-mask">{saved}</span>}
      editLabel="Edit username"
      canSave={checked.ok && checked.nickname !== saved}
      pending={pending}
      error={error}
      onSave={submit}
    >
      <InlineField
        label="Username"
        htmlFor="username-field"
        aside={
          <>
            <span className={left < 0 ? "text-destructive" : undefined}>{left}</span>
            <span className="sr-only"> characters left</span>
          </>
        }
        error={problem}
      >
        <InlineFieldInput
          id="username-field"
          name="nickname"
          className="ph-mask"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          // A little room over the limit, so that the counter can go below zero and the field can say why the name is refused
          maxLength={DISPLAY_NAME_MAX * 2}
          autoComplete="nickname"
          // A field called username is where a password manager offers a login: this one is not it
          data-1p-ignore
          data-lpignore="true"
          disabled={pending}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? "username-field-error" : undefined}
        />
      </InlineField>
    </InlineEdit>
  )
}
