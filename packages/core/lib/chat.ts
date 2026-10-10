/**
 * Chat constants shared by the client (`realtime.ts`, `components/game/chat.tsx`) and the chat API route.
 *
 * Messages and reactions go through `POST /api/games/[code]/chat`: the server reads the player from the cookie,
 * then broadcasts on the chat channel. Clients only listen to the `*_SERVER_EVENT` events and never send them.
 */

export const CHAT_MAX_LENGTH = 200

/** Realtime channel of a game's chat (the schema keeps two games sharing a code apart on the shared Supabase project). */
export const chatChannel = (code: string) => `chat:${process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public"}:${code}`

/**
 * Event names broadcast by the server only. Older clients sent `chat` / `reaction` themselves: those events are now ignored.
 * The anon key can still broadcast on this channel (public Realtime channel), so this filters out legacy and naive spoofing,
 * not a determined attacker: closing that requires private channels with Realtime Authorization.
 */
export const CHAT_SERVER_EVENT = "chat:server"
export const REACTION_SERVER_EVENT = "reaction:server"

/** Ids of the built-in reactions (`DEFAULT_REACTIONS` in `soundboard.ts`, keep in sync). A game adds its own through `REACTIONS` in @pbgo/binding. */
export const DEFAULT_REACTION_IDS = ["clap", "laugh", "wow", "party", "evil", "sad", "fire", "love"] as const

export type ChatMessage = { id: string; playerId: string; text: string; at: number }
export type ChatReaction = { id: string; playerId: string; reaction: string }

/** Client-chosen id, used only to match the optimistic message with its broadcast. */
export const CHAT_ID = /^[A-Za-z0-9-]{1,64}$/
