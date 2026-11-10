"use client"

import * as React from "react"
import { UserAdd01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "./input-group"

// The way to add a friend, as the Riot Client has it: the username and the tag side by side (the tag is the narrow field, after a hash), and under them one button, as wide as both, that stays off (a dark grey one) until both
// are filled, when it turns white. It decides nothing: `onSend` gets what was typed as `username#tag` (PLT-39), and without it the form is off. A hash typed in the username ends it: what comes after it (a whole id pasted
// there, `Username#Tag`) goes to the tag field, which takes the focus. What was sent is cleared, so that the next friend can be typed at once. A field that says "username" is where a password manager offers a login, so the
// field is called `friend-username` and the managers are told to leave it alone (`data-1p-ignore`, `data-lpignore`). `onSend` may answer `false`, or a promise of it, for a request that was refused: what was typed is then kept, so that a mistake is corrected
// and not typed again, and the button is off while the answer is awaited.

/** The width of the tag's field: a hash and a few characters. */
const TAG_WIDTH = "w-26 shrink-0"

function AddFriendForm({
  onSend,
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit" | "children"> & {
  /** What sending does with the username and the tag, written as `username#tag`. The form is off without it. It may answer `false` (or a promise of it) to keep what was typed; any other answer clears the fields. */
  onSend?: (who: string) => void | boolean | Promise<boolean | void>
}) {
  const [username, setUsername] = React.useState("")
  const [tag, setTag] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const tagField = React.useRef<HTMLInputElement>(null)
  const off = !onSend
  const ready = username.trim() !== "" && tag.trim() !== ""

  function typeUsername(value: string) {
    const hash = value.indexOf("#")
    if (hash === -1) {
      setUsername(value)
      return
    }
    setUsername(value.slice(0, hash))
    setTag(value.slice(hash + 1).replace(/#/g, ""))
    tagField.current?.focus()
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onSend || !ready || sending) return
    const answer = onSend(`${username.trim()}#${tag.trim()}`)
    if (typeof answer === "object" && answer !== null && "then" in answer) {
      setSending(true)
      const kept = await Promise.resolve(answer).catch(() => false)
      setSending(false)
      if (kept === false) return
    } else if (answer === false) return
    setUsername("")
    setTag("")
  }

  return (
    <form data-slot="add-friend-form" aria-label="Add a friend" className={cn("flex flex-col gap-2", className)} onSubmit={send} {...props}>
      <div className="flex gap-2">
        <InputGroup>
          <InputGroupAddon>
            <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} />
          </InputGroupAddon>
          <InputGroupInput
            name="friend-username"
            value={username}
            onChange={(event) => typeUsername(event.target.value)}
            placeholder="Username"
            aria-label="Username of the friend"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            disabled={off}
          />
        </InputGroup>
        <InputGroup className={TAG_WIDTH}>
          <InputGroupAddon>
            <InputGroupText aria-hidden="true">#</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            ref={tagField}
            name="tag"
            value={tag}
            onChange={(event) => setTag(event.target.value.replace(/#/g, ""))}
            placeholder="Tag"
            aria-label="Tag of the friend"
            autoComplete="off"
            disabled={off}
          />
        </InputGroup>
      </div>
      <Button type="submit" size="lg" variant={ready && !off ? "default" : "secondary"} className="w-full" disabled={off || !ready || sending} aria-busy={sending || undefined}>
        Add friend
      </Button>
    </form>
  )
}

export { AddFriendForm }
