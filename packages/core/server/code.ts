const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const CODE_LENGTH = 6

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

export function validCode(code: string): boolean {
  return new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`).test(code)
}
