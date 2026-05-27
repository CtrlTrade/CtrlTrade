import { createHmac, randomBytes } from "node:crypto";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str: string): Buffer {
  const s = str.toUpperCase().replace(/=+$/, "");
  const buf = Buffer.alloc(Math.floor((s.length * 5) / 8));
  let bits = 0;
  let value = 0;
  let idx = 0;
  for (const ch of s) {
    const v = BASE32_CHARS.indexOf(ch);
    if (v === -1) continue;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      buf[idx++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buf.subarray(0, idx);
}

function hotp(secret: string, counter: bigint): number {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigInt64BE(counter);
  const hmac = createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return code % 10 ** 6;
}

const STEP = 30;

function currentCounter(): bigint {
  return BigInt(Math.floor(Date.now() / 1000 / STEP));
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function generateTotpCode(secret: string): string {
  return String(hotp(secret, currentCounter())).padStart(6, "0");
}

export function verifyTotpCode(token: string, secret: string, window = 1): boolean {
  const c = currentCounter();
  for (let i = -window; i <= window; i++) {
    const expected = String(hotp(secret, c + BigInt(i))).padStart(6, "0");
    if (expected === token) return true;
  }
  return false;
}

export function generateOtpAuthUri(account: string, issuer: string, secret: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
}
