"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { handleOfPerson, messageOfChat } from "@pbgo/core/lib/friends-view"
import { MESSAGES_PATH, messageActionPath, threadOf, type ChatMessage } from "@pbgo/core/lib/messages"
import { ApiClientError, gameRequest } from "@pbgo/core/lib/api"
import type { Friend } from "@pbgo/ui/friends"
import type { Message } from "@pbgo/ui/social"
import { toast } from "@pbgo/ui/platform/sonner"
import { refreshSocial } from "./social-store"
import { messageOf } from "./table-door"

/** How often the open chat asks for the conversation again, in ms, while it is on screen and in view: the same way the friends are read (a poll, no new infrastructure), only quicker, since somebody is waiting for an answer. */
export const CHAT_POLL_MS = 5_000

/** Two reads of a thread that say the same thing change nothing: the window is not drawn again every few seconds for no reason. */
const sameThread = (a: readonly ChatMessage[], b: readonly ChatMessage[]) => a.length === b.length && a.every((message, index) => message.id === b[index]?.id)

/**
 * The conversation of the member with a friend for the chat window (PLT-25): read when the chat opens and every `CHAT_POLL_MS` while it is open and the tab is in view (`GET /api/hub/messages`), what the friend wrote is marked as read as soon as it is on screen
 * (`POST …/read`, then the social state is read again, so that the count on the picture and in the list goes), and `send` writes a message (`POST …/send`) and shows it at once. A refusal of the server (a friend who was removed or blocked, the limit of unread messages) is a toast in the
 * platform's words, and keeps what was written. `gone` runs when the conversation cannot be read any more (the friend was removed, or blocked the member), so that the window closes. Nothing is asked while no friend is given (`friend` null) or while the chat is not `active` (it is closed, and what it showed stays for as long as it takes to leave).
 */
export function useChatThread(friend: Friend | null, { active = true, onGone }: { active?: boolean; onGone?: () => void } = {}): { messages: Message[]; send: (text: string) => Promise<boolean> } {
  const who = friend ? handleOfPerson(friend) : null
  const key = who ? `${who.nickname.toLowerCase()}#${who.tag}` : null
  const [thread, setThread] = useState<{ key: string; messages: ChatMessage[] } | null>(null)
  const gone = useRef(onGone)
  useEffect(() => {
    gone.current = onGone
  })

  useEffect(() => {
    if (!who || !key || !active) return
    let stopped = false
    const load = async () => {
      try {
        const body = await gameRequest<unknown>(`${MESSAGES_PATH}?nickname=${encodeURIComponent(who.nickname)}&tag=${who.tag}`)
        const next = threadOf(body)
        if (!next || stopped) return
        setThread((current) => (current && current.key === key && sameThread(current.messages, next.messages) ? current : { key, messages: next.messages }))
        if (next.unread > 0) {
          await gameRequest(messageActionPath("read"), { method: "POST", body: JSON.stringify({ nickname: who.nickname, tag: who.tag }) })
          refreshSocial()
        }
      } catch (error) {
        // A friend who is not one any more, or who blocked the member, is a conversation that is over: the window closes (the server says it is the same answer for both)
        if (!stopped && error instanceof ApiClientError && (error.code === "MESSAGE_NOT_FRIEND" || error.code === "FRIEND_NOT_FOUND")) gone.current?.()
      }
    }
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, CHAT_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
    // `who` is derived from `key`, which is what identifies the friend
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active])

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (!who || !key) return false
      try {
        const { message } = await gameRequest<{ ok: true; message: unknown }>(messageActionPath("send"), { method: "POST", body: JSON.stringify({ nickname: who.nickname, tag: who.tag, text }) })
        const sent = threadOf({ messages: [message], unread: 0 })?.messages[0]
        if (sent) setThread((current) => ({ key, messages: [...(current && current.key === key ? current.messages.filter((item) => item.id !== sent.id) : []), sent] }))
        return true
      } catch (error) {
        toast.error(messageOf(error))
        return false
      } finally {
        refreshSocial()
      }
    },
    // `who` is derived from `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  return { messages: thread && thread.key === key ? thread.messages.map(messageOfChat) : [], send }
}
