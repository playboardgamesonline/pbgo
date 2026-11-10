/** A number that is never negative: -1 modulo 5 is 4 */
const modulo = (value: number, by: number) => ((value % by) + by) % by

/**
 * The spaces a marker goes through on the way from space `from` to space `to` of a track of `count` spaces, one after the other, the last being `to`: none when it does not move. On a track that does not loop it goes the straight way. On one
 * that loops it takes the shorter way round, forward when both ways are as long. Spaces are numbered from 0, as the spaces of the board are (the track of the engine may start at another number: subtract its first).
 */
export function routeBetween(from: number, to: number, count: number, loop = false): number[] {
  if (from === to || count < 1) return []
  if (!loop) {
    const direction = Math.sign(to - from)
    return Array.from({ length: Math.abs(to - from) }, (_, i) => from + direction * (i + 1))
  }
  const forward = modulo(to - from, count)
  const back = count - forward
  const direction = forward <= back ? 1 : -1
  return Array.from({ length: direction === 1 ? forward : back }, (_, i) => modulo(from + direction * (i + 1), count))
}

/**
 * Where each of `of` markers that share a space stands, in the frame of the space (x to the right, z toward the viewer, the middle of the space at 0, 0): a lone marker in the middle, then the markers side by side in lines, in reading
 * order, the whole group centred. `spread` is the distance between two markers.
 */
export function slotOffset(slot: number, of: number, spread: number): { x: number; z: number } {
  if (of <= 1) return { x: 0, z: 0 }
  const columns = Math.ceil(Math.sqrt(of))
  const lines = Math.ceil(of / columns)
  return { x: ((slot % columns) - (columns - 1) / 2) * spread, z: (Math.floor(slot / columns) - (lines - 1) / 2) * spread }
}
