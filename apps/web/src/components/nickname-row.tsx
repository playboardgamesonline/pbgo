"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { DISPLAY_NAME_MAX, checkNickname, checkTag, nicknameCharactersLeft, tagText } from "@pbgo/accounts"
import { saveNickname, useAccount } from "@pbgo/accounts/client"
import { trackClient } from "@pbgo/analytics/client"
import { ApiClientError, gameRequest } from "@pbgo/core/lib/api"
import { InlineEdit, InlineField, InlineFieldInput } from "@pbgo/ui/platform/inline-edit"
import { toast } from "@pbgo/ui/platform/sonner"
import { changing, failureOf } from "@/lib/settings-change"
import { messageOf } from "@/lib/table-door"
import { rememberOwnHandle } from "@/lib/use-own-handle"

/** What the analytics are told of a refusal: the three ways the profile route says no. */
const REFUSALS: Record<string, "taken" | "invalid" | "unavailable"> = { PROFILE_TAKEN: "taken", PROFILE_INVALID: "invalid", PROFILE_UNAVAILABLE: "unavailable" }

/**
 * The Username row of the settings: the name with its tag (`Alex#0042`), edited in place with two fields. `POST /api/hub/profile` keeps the pair and says when it is taken. The account keeps a copy of the name (`saveNickname`) for the navbar. Without a tag (no profile yet) the row edits the name alone.
 */
export function NicknameRow({ nickname, tag, demo }: { nickname: string; tag: number | null; demo: boolean }) {
  const router = useRouter()
  const session = useAccount()
  const [saved, setSaved] = useState({ nickname, tag })
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(nickname)
  const [tagValue, setTagValue] = useState(tag === null ? "" : tagText(tag))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const checked = checkNickname(value)
  const checkedTag = saved.tag === null ? null : checkTag(tagValue)
  // The fields start out as what the row holds, which is right: a mistake can only be one the member typed
  const problem = checked.ok ? null : checked.problem
  const tagProblem = checkedTag && !checkedTag.ok ? checkedTag.problem : null
  const left = nicknameCharactersLeft(value)
  const changed = checked.ok && checked.nickname !== saved.nickname
  const tagChanged = checkedTag !== null && checkedTag.ok && checkedTag.tag !== saved.tag

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setValue(saved.nickname)
      setTagValue(saved.tag === null ? "" : tagText(saved.tag))
      setError(null)
    }
  }

  async function submit() {
    if (!checked.ok || (checkedTag !== null && !checkedTag.ok)) return
    setError(null)
    setPending(true)
    const newTag = checkedTag?.ok ? checkedTag.tag : null
    if (newTag !== null) {
      try {
        // The profile is the server's: the pair is checked there, in one statement, against the other members'
        if (!demo) await gameRequest("/api/hub/profile", { method: "POST", body: JSON.stringify({ nickname: checked.nickname, tag: newTag }) })
      } catch (failure) {
        setPending(false)
        const reason = failure instanceof ApiClientError ? REFUSALS[failure.code] : undefined
        if (reason) trackClient("profile_update_refused", { reason })
        setError(messageOf(failure))
        return
      }
    }
    // The account keeps a copy of the name for the pages that read it in the browser (the navbar): the profile is already changed, so a copy that cannot be written is no reason to say the change failed
    const outcome = await changing(demo, () => saveNickname(checked.nickname))
    setPending(false)
    const failure = failureOf(outcome)
    if (failure && newTag === null) {
      setError(failure)
      return
    }
    if (newTag !== null) {
      trackClient("profile_updated", { nickname: changed, tag: tagChanged })
      // The account menu and the head of the panel say the new pair at once
      if (session.status === "signed-in") rememberOwnHandle(session.account.id, { nickname: checked.nickname, tag: newTag })
    }
    setSaved({ nickname: checked.nickname, tag: newTag ?? saved.tag })
    setOpen(false)
    toast.success(newTag === null ? "Username saved" : "Username and tag saved")
    router.refresh()
  }

  return (
    <InlineEdit
      open={open}
      onOpenChange={toggle}
      title="Username"
      value={
        <span className="ph-mask">
          {saved.nickname}
          {saved.tag !== null && <span className="text-muted-foreground">#{tagText(saved.tag)}</span>}
        </span>
      }
      editLabel="Edit username"
      canSave={checked.ok && (checkedTag === null || checkedTag.ok) && (changed || tagChanged)}
      pending={pending}
      error={error}
      onSave={submit}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
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
        </div>
        {saved.tag !== null && (
          <div className="w-28 shrink-0">
            <InlineField label="Tag" htmlFor="tag-field" error={tagProblem}>
              <InlineFieldInput
                id="tag-field"
                name="tag"
                className="ph-mask tabular-nums"
                value={tagValue}
                onChange={(event) => {
                  setTagValue(event.target.value)
                  setError(null)
                }}
                inputMode="numeric"
                maxLength={5}
                autoComplete="off"
                data-autoselect
                data-1p-ignore
                data-lpignore="true"
                disabled={pending}
                aria-invalid={tagProblem ? true : undefined}
                aria-describedby={tagProblem ? "tag-field-error" : undefined}
              />
            </InlineField>
          </div>
        )}
      </div>
    </InlineEdit>
  )
}
