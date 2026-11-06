// Signup proof of work, the same algorithm the Replyz API checks:
// find a nonce so that SHA-256("<challenge>:<nonce>") starts with `difficulty` zero bits.
// Difficulty 20 ≈ one million hashes ≈ 1 s on a laptop.
import { createHash } from "node:crypto";

export function leadingZeroBits(buf: Uint8Array): number {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24; // clz32 counts 32 bits; a byte uses the low 8
  }
  return bits;
}

/** Brute force: nonce = counter in base 36 (the server accepts [0-9A-Za-z]{1,32}). */
export function solvePow(challenge: string, difficulty: number): string {
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 32) {
    throw new Error(`unexpected proof-of-work difficulty ${difficulty}`);
  }
  for (let i = 0; ; i++) {
    const nonce = i.toString(36);
    if (leadingZeroBits(createHash("sha256").update(`${challenge}:${nonce}`).digest()) >= difficulty) {
      return nonce;
    }
  }
}
