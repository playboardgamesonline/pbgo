/** How many things on a canvas want the touches that begin on it, and what its `touch-action` was before: a canvas with something to drag or to draw on does not scroll the page under a finger, and one with nothing keeps doing it */
const touching = new WeakMap<HTMLElement, { count: number; was: string }>()

export function claimTouch(element: HTMLElement): () => void {
  const claim = touching.get(element) ?? { count: 0, was: element.style.touchAction }
  if (claim.count === 0) claim.was = element.style.touchAction
  claim.count++
  touching.set(element, claim)
  element.style.touchAction = "none"
  return () => {
    claim.count--
    if (claim.count === 0) element.style.touchAction = claim.was
  }
}

