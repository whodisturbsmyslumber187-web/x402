/**
 * Encoding Utilities
 * 
 * Base64 encoding/decoding for x402 headers.
 */

/**
 * Encode data to base64 (for X-PAYMENT header)
 */
export function encodePaymentHeader(data: unknown): string {
  const json = JSON.stringify(data);
  // Use Buffer in Node.js, btoa in browser
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf-8').toString('base64');
  }
  return btoa(json);
}

/**
 * Decode base64 to data (from X-PAYMENT header)
 */
export function decodePaymentHeader<T = unknown>(encoded: string): T {
  // Use Buffer in Node.js, atob in browser
  let json: string;
  if (typeof Buffer !== 'undefined') {
    json = Buffer.from(encoded, 'base64').toString('utf-8');
  } else {
    json = atob(encoded);
  }
  return JSON.parse(json) as T;
}

/**
 * Safely decode payment header with error handling
 */
export function safeDecodePaymentHeader<T = unknown>(
  encoded: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = decodePaymentHeader<T>(encoded);
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to decode payment header' 
    };
  }
}

/**
 * Convert bigint-friendly amounts to string
 */
export function amountToString(amount: bigint | number | string): string {
  return String(amount);
}

/**
 * Parse amount string to bigint
 */
export function parseAmount(amount: string): bigint {
  return BigInt(amount);
}

/**
 * Format amount for display (with decimals)
 */
export function formatAmount(
  amount: string | bigint, 
  decimals: number = 6
): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const remainder = value % divisor;
  
  if (remainder === 0n) {
    return whole.toString();
  }
  
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmed = remainderStr.replace(/0+$/, '');
  return `${whole}.${trimmed}`;
}

/**
 * Parse display amount to atomic units
 */
export function parseDisplayAmount(
  displayAmount: string, 
  decimals: number = 6
): bigint {
  const [whole, fraction = ''] = displayAmount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}
