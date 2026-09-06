/**
 * Cryptographic SHA-256 Integrity Verification Service
 * 
 * Generates and verifies cryptographic hash fingerprints for finalized OIML R-76 test reports.
 * Uses browser Web Crypto API (SubtleCrypto) with a standard FIPS 180-4 fallback for sandboxed environments.
 */

import { TestRecord } from '../types';

/**
 * Standard FIPS 180-4 SHA-256 implementation fallback for sandboxed/non-secure contexts
 * where window.crypto.subtle may be unavailable.
 */
function sha256Fallback(bytes: Uint8Array): string {
  function rotr(n: number, x: number) {
    return (x >>> n) | (x << (32 - n));
  }
  function ch(x: number, y: number, z: number) {
    return (x & y) ^ (~x & z);
  }
  function maj(x: number, y: number, z: number) {
    return (x & y) ^ (x & z) ^ (y & z);
  }
  function sigma0(x: number) {
    return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
  }
  function sigma1(x: number) {
    return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
  }
  function gamma0(x: number) {
    return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
  }
  function gamma1(x: number) {
    return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
  }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const withPad = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
  withPad.set(bytes);
  withPad[len] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, bitLen >>> 0, false);
  view.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) >>> 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0;
      const T2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      h = g; g = f; f = e; e = (d + T1) >>> 0;
      d = c; c = b; b = a; a = (T1 + T2) >>> 0;
    }

    H0 = (H0 + a) >>> 0;
    H1 = (H1 + b) >>> 0;
    H2 = (H2 + c) >>> 0;
    H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0;
    H5 = (H5 + f) >>> 0;
    H6 = (H6 + g) >>> 0;
    H7 = (H7 + h) >>> 0;
  }

  return [H0, H1, H2, H3, H4, H5, H6, H7]
    .map((h) => h.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Recursively orders object keys alphabetically to ensure deterministic JSON serialization
 */
function canonicalize(val: any): any {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  const sortedKeys = Object.keys(val).sort();
  const res: Record<string, any> = {};
  for (const key of sortedKeys) {
    if (val[key] !== undefined) {
      res[key] = canonicalize(val[key]);
    }
  }
  return res;
}

/**
 * Creates canonical string representation of critical test report data for hashing.
 * Ordering and formatting are strictly deterministic to ensure reproducible hashes.
 */
export function createCanonicalReportPayload(test: TestRecord): string {
  const inst = test.instrumentSnapshot || ({} as any);

  const payload = {
    reportId: test.reportId || `REP-${test.testId || test.id}`,
    testId: test.testId || test.id,
    instrumentId: inst.instrumentId || inst.id || '',
    serialNumber: inst.serialNumber || '',
    manufacturer: inst.manufacturer || '',
    model: inst.model || '',
    accuracyClass: inst.accuracyClass || 'III',
    maxCapacity: Number(inst.maxCapacity) || 0,
    minCapacity: Number(inst.minCapacity) || 0,
    capacityUnit: inst.capacityUnit || 'kg',
    e: Number(inst.e) || 0,
    d: Number(inst.d) || 0,
    intervalUnit: inst.intervalUnit || 'g',
    testerName: test.testerName || 'N/A',
    reviewerName: test.reviewerName || 'N/A',
    approverName: test.approverName || 'N/A',
    overallCompliance: Boolean(test.overallCompliance),
    finalizedAt: test.finalizedAt || test.updatedAt || '',
    weighingPerformancePoints: (test.weighingPerformance?.points || []).map((p) => ({
      ref: Number(p.referenceLoad),
      ind: Number(p.indicatedLoad),
      err: Number(p.error),
      mpe: Number(p.applicableMpeAbsolute),
      pass: Boolean(p.passed),
    })),
    repeatability: test.repeatability
      ? {
          load: Number(test.repeatability.testLoad),
          spread: Number(test.repeatability.rangeSpread),
          allowed: Number(test.repeatability.allowedRangeSpread),
          pass: Boolean(test.repeatability.passed),
        }
      : null,
    eccentricity: test.eccentricity
      ? {
          load: Number(test.eccentricity.testLoad),
          maxDev: Number(test.eccentricity.maxDeviation),
          allowed: Number(test.eccentricity.allowedLimit),
          pass: Boolean(test.eccentricity.passed),
        }
      : null,
    zeroTare: test.zeroTare
      ? {
          zeroErr: Number(test.zeroTare.zeroSettingError),
          tareDev: Number(test.zeroTare.tareDeviation),
          returnDev: Number(test.zeroTare.returnToZeroDeviation),
          pass: Boolean(test.zeroTare.overallPassed),
        }
      : null,
  };

  return JSON.stringify(canonicalize(payload));
}

/**
 * Calculates SHA-256 hexadecimal hash string synchronously using standard FIPS 180-4 implementation.
 * Safe and instantaneous across all browser environments and sandboxed iframes.
 */
export function computeSha256Sync(message: string): string {
  if (typeof message !== 'string') {
    throw new Error('computeSha256 requires a valid string message');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  return sha256Fallback(data);
}

/**
 * Calculates SHA-256 hexadecimal hash string for any input string.
 * Guaranteed to resolve immediately without hanging.
 */
export async function computeSha256(message: string): Promise<string> {
  return computeSha256Sync(message);
}

/**
 * Generates SHA-256 for a finalized test record synchronously.
 */
export function generateReportIntegrityHashSync(test: TestRecord): string {
  const canonical = createCanonicalReportPayload(test);
  return computeSha256Sync(canonical);
}

/**
 * Generates SHA-256 for a finalized test record.
 */
export async function generateReportIntegrityHash(test: TestRecord): Promise<string> {
  return generateReportIntegrityHashSync(test);
}

/**
 * Verifies if a test record's data matches its recorded SHA-256 hash.
 */
export async function verifyReportIntegrity(
  test: TestRecord,
  storedHash?: string
): Promise<{
  isValid: boolean;
  computedHash: string;
  expectedHash: string;
  tamperDetected: boolean;
}> {
  const expectedHash = (storedHash || test.sha256Hash || '').trim().toLowerCase();
  const computedHash = (await generateReportIntegrityHash(test)).toLowerCase();

  const isValid = expectedHash !== '' && computedHash === expectedHash;

  return {
    isValid,
    computedHash,
    expectedHash,
    tamperDetected: !isValid && expectedHash !== '',
  };
}
