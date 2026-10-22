import { Fragment, type ReactNode } from "react"

/** A text with `{slot}`s filled by strings; a slot it has no value for stays as written. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (slot, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : slot))
}

/** A text with `{slot}`s filled by nodes (a nickname, a card): the words around them stay plain text. */
export function Sentence({ text, slots }: { text: string; slots: Record<string, ReactNode> }) {
  return (
    <>
      {text.split(/(\{\w+\})/g).map((part, index) => {
        const key = /^\{(\w+)\}$/.exec(part)?.[1]
        return <Fragment key={index}>{key && Object.hasOwn(slots, key) ? slots[key] : part}</Fragment>
      })}
    </>
  )
}
