import { AuditLogEntry, ChainVerificationResult } from '../types';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a cryptographically secure random Base32 secret key (160-bit, 32 characters)
 */
export function generateBase32Secret(): string {
  const bytes = new Uint8Array(20);
  window.crypto.getRandomValues(bytes);
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output.substring(0, 32);
}

/**
 * Decode Base32 string to Uint8Array
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Convert ArrayBuffer or Uint8Array to hex string
 */
export function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert string to UTF-8 Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Import a Base32 secret as a SubtleCrypto HMAC Key
 */
export async function getHmacCryptoKey(secretBase32: string, hashAlgo: 'SHA-256' | 'SHA-1' = 'SHA-256'): Promise<CryptoKey> {
  const rawBytes = base32ToBytes(secretBase32);
  const keyBytes = rawBytes.length >= 16 ? rawBytes : stringToBytes(secretBase32.padEnd(32, '0'));

  return await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: hashAlgo },
    false,
    ['sign', 'verify']
  );
}

/**
 * Calculate HMAC-SHA256 for a given payload string
 * Formula: HMAC-SHA256(payload, secretKey)
 */
export async function computeHmacSha256(payload: string, secretBase32: string): Promise<string> {
  const key = await getHmacCryptoKey(secretBase32, 'SHA-256');
  const data = stringToBytes(payload);
  const signature = await window.crypto.subtle.sign('HMAC', key, data);
  return bufToHex(signature);
}

/**
 * Compute the next hash in the immutable Hash-Chain:
 * Hash_n = HMAC-SHA256(Timestamp + EventType + Hash_{n-1}, SecretKey)
 */
export async function computeBlockHash(
  timestamp: number,
  eventType: string,
  prevHash: string,
  secretBase32: string
): Promise<string> {
  // Payload strictly adheres to: Timestamp + EventType + Hash_{n-1}
  const payload = `${timestamp}${eventType}${prevHash}`;
  return await computeHmacSha256(payload, secretBase32);
}

/**
 * Generate Genesis zero block hash
 */
export async function generateGenesisHash(secretBase32: string, customNonce = 'AEGIS_GENESIS_BLOCK_0'): Promise<string> {
  return await computeHmacSha256(`0:GENESIS:${customNonce}`, secretBase32);
}

/**
 * Verify complete hash-chain integrity from block 0 (genesis) to the tip
 */
export async function verifyHashChain(
  entries: AuditLogEntry[],
  secretBase32: string
): Promise<ChainVerificationResult> {
  if (!entries || entries.length === 0) {
    return {
      allValid: true,
      tamperedIndex: null,
      totalBlocks: 0,
      verifiedAt: Date.now(),
    };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.eventType === 'GENESIS') {
      // Genesis entry verification
      const expectedGenesis = await generateGenesisHash(secretBase32, 'AEGIS_GENESIS_BLOCK_0');
      if (entry.hash !== expectedGenesis && entry.hash.length < 32) {
        return {
          allValid: false,
          tamperedIndex: i,
          totalBlocks: entries.length,
          verifiedAt: Date.now(),
        };
      }
      continue;
    }

    const prevEntry = entries[i - 1];
    if (prevEntry && entry.prevHash !== prevEntry.hash) {
      // Chain linkage broken
      return {
        allValid: false,
        tamperedIndex: i,
        totalBlocks: entries.length,
        verifiedAt: Date.now(),
      };
    }

    // Recalculate HMAC-SHA256
    const payload = `${entry.timestamp}${entry.eventType}${entry.prevHash}`;
    const expectedHash = await computeHmacSha256(payload, secretBase32);

    if (entry.hash.toLowerCase() !== expectedHash.toLowerCase()) {
      return {
        allValid: false,
        tamperedIndex: i,
        totalBlocks: entries.length,
        verifiedAt: Date.now(),
      };
    }
  }

  return {
    allValid: true,
    tamperedIndex: null,
    totalBlocks: entries.length,
    verifiedAt: Date.now(),
  };
}

/**
 * RFC 6238 TOTP Implementation with 60-second time-step interval
 */
export async function generateTotp(
  secretBase32: string,
  timestampMs: number = Date.now()
): Promise<{ code: string; remainingSeconds: number; progress: number; currentEpochStep: number }> {
  const timeStepSeconds = 60;
  const currentEpochStep = Math.floor(timestampMs / 1000 / timeStepSeconds);
  const secondsIntoInterval = Math.floor((timestampMs / 1000) % timeStepSeconds);
  const remainingSeconds = timeStepSeconds - secondsIntoInterval;
  const progress = (secondsIntoInterval / timeStepSeconds) * 100;

  // Convert counter to 8-byte big-endian
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // Upper 4 bytes: 0
  counterView.setUint32(0, 0, false);
  // Lower 4 bytes: step counter
  counterView.setUint32(4, currentEpochStep, false);

  const key = await getHmacCryptoKey(secretBase32, 'SHA-256');
  const signature = await window.crypto.subtle.sign('HMAC', key, counterBuffer);
  const hash = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226 / RFC 6238)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  const code = otp.toString().padStart(6, '0');

  return {
    code,
    remainingSeconds,
    progress,
    currentEpochStep,
  };
}

/**
 * Verify a 6-digit TOTP code with +-1 time window tolerance (60s step)
 */
export async function verifyTotp(
  inputCode: string,
  secretBase32: string,
  timestampMs: number = Date.now()
): Promise<boolean> {
  const cleanInput = inputCode.trim().replace(/\s+/g, '');
  if (cleanInput.length !== 6 || !/^\d{6}$/.test(cleanInput)) {
    return false;
  }

  const timeStepSeconds = 60;
  const currentStep = Math.floor(timestampMs / 1000 / timeStepSeconds);

  // Check windows: current step, -1 step, +1 step for slight clock drift
  for (const stepOffset of [0, -1, 1]) {
    const testStep = currentStep + stepOffset;
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(0, 0, false);
    counterView.setUint32(4, testStep, false);

    const key = await getHmacCryptoKey(secretBase32, 'SHA-256');
    const signature = await window.crypto.subtle.sign('HMAC', key, counterBuffer);
    const hash = new Uint8Array(signature);

    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const expectedCode = (binary % 1000000).toString().padStart(6, '0');
    if (expectedCode === cleanInput) {
      return true;
    }
  }

  return false;
}

/**
 * Format timestamp to DD.MM.YY HH:MM:SS
 */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format timestamp to short DD.MM.YY HH:MM
 */
export function formatShortTimestamp(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}
