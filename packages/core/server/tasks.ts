import "server-only"

export type Task = { id: string; text: string; category: string; done: boolean; sort_order: number; created_at: string }

export function sanitizeText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}
