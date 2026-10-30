/**
 * TON address helpers. TonAPI returns raw addresses ("0:E93E…"), wallets show
 * user-friendly ones ("UQ…"/"EQ…"). Everything is compared in normalized raw
 * form: lowercase "<workchain>:<64 hex>".
 */

function crc16(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_');
}

export interface ParsedAddress {
  workchain: number;
  hash: string; // 64 lowercase hex chars
  testnetOnly: boolean;
  bounceable: boolean;
}

/** Parses raw or user-friendly addresses. Throws on anything invalid (including bad checksum). */
export function parseAddress(input: string): ParsedAddress {
  const value = input.trim();
  const raw = /^(-?\d+):([0-9a-fA-F]{64})$/.exec(value);
  if (raw) return { workchain: Number(raw[1]), hash: raw[2]!.toLowerCase(), testnetOnly: false, bounceable: true };
  if (!/^[A-Za-z0-9_\-+/]{48}$/.test(value)) throw new Error('Invalid TON address');
  const bytes = base64UrlToBytes(value);
  if (bytes.length !== 36) throw new Error('Invalid TON address length');
  const expected = (bytes[34]! << 8) | bytes[35]!;
  if (crc16(bytes.subarray(0, 34)) !== expected) throw new Error('Invalid TON address checksum');
  const flags = bytes[0]!;
  const tag = flags & 0x7f;
  if (tag !== 0x11 && tag !== 0x51) throw new Error('Invalid TON address flags');
  const wc = bytes[1]! > 127 ? bytes[1]! - 256 : bytes[1]!;
  const hash = [...bytes.subarray(2, 34)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { workchain: wc, hash, testnetOnly: (flags & 0x80) !== 0, bounceable: tag === 0x11 };
}

export function toRaw(input: string): string {
  const a = parseAddress(input);
  return `${a.workchain}:${a.hash}`;
}

export function sameAddress(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  try {
    return toRaw(a) === toRaw(b);
  } catch {
    return false;
  }
}

/** User-friendly form for showing to people and for ton:// links. */
export function toFriendly(input: string, opts: { bounceable: boolean; testnet: boolean }): string {
  const a = parseAddress(input);
  const bytes = new Uint8Array(36);
  bytes[0] = (opts.bounceable ? 0x11 : 0x51) | (opts.testnet ? 0x80 : 0);
  bytes[1] = a.workchain & 0xff;
  for (let i = 0; i < 32; i++) bytes[2 + i] = parseInt(a.hash.slice(i * 2, i * 2 + 2), 16);
  const crc = crc16(bytes.subarray(0, 34));
  bytes[34] = crc >> 8;
  bytes[35] = crc & 0xff;
  return bytesToBase64Url(bytes);
}
