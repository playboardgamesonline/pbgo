// The pure half of a picture that lies flat on the table: what it is drawn after, and its proportions. `picture.tsx` draws it and `picture-look.test.ts` holds it.

/** What a flat picture is drawn after (`renderOrder`): over the mat and what lies flat on it, as the signs and the stickers of a board are */
export const PICTURE = { order: 4 } as const

/** The proportions of a picture, width over height: those of the image its texture holds, and a square when it holds none or one of no size */
export function pictureAspect(texture: { image?: unknown }): number {
  const image = texture.image as { width?: number; height?: number } | null | undefined
  const width = image?.width
  const height = image?.height
  return typeof width === "number" && typeof height === "number" && width > 0 && height > 0 ? width / height : 1
}
