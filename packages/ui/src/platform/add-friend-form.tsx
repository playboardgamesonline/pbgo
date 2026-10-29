"use client"

import * as React from "react"
import { UserAdd01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "./input-group"

// The way to add a friend, as the Riot Client has it: the nickname and the tag side by side (the tag is the narrow field, after a hash), and under them one button, as wide as both, that stays off (a dark grey one) until both
// are filled, when it turns white. It decides nothing: `onSend` gets what was typed as `nickname#tag` (PLT-39), and without it the form is off. A hash typed in the nickname ends it: what comes after it (a whole id pasted
// there, `Nickname#Tag`) goes to the tag field, which takes the focus. What was sent is cleared, so that the next friend can be typed at once.

/** The width of the tag's field: a hash and a few characters. */
const TAG_WIDTH = "w-26 shrink-0"

function AddFriendForm({
  onSend,
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit" | "children"> & {
  /** What sending does with the nickname and the tag, written as `nickname#tag`. The form is off without it. */
  onSend?: (who: string) => void
}) {
  const [nickname, setNickname] = React.useState("")
  const [tag, setTag] = React.useState("")
  const tagField = React.useRef<HTMLInputElement>(null)
  const off = !onSend
  const ready = nickname.trim() !== "" && tag.trim() !== ""

  function typeNickname(value: string) {
    const hash = value.indexOf("#")
    if (hash === -1) {
      setNickname(value)
      return
    }
    setNickname(value.slice(0, hash))
    setTag(value.slice(hash + 1).replace(/#/g, ""))
    tagField.current?.focus()
  }

  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onSend || !ready) return
    onSend(`${nickname.trim()}#${tag.trim()}`)
    setNickname("")
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
            name="nickname"
            value={nickname}
            onChange={(event) => typeNickname(event.target.value)}
            placeholder="Nickname"
            aria-label="Nickname of the friend"
            autoComplete="off"
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
      <Button type="submit" size="lg" variant={ready && !off ? "default" : "secondary"} className="w-full" disabled={off || !ready}>
        Add friend
      </Button>
    </form>
  )
}

export { AddFriendForm }
