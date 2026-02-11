/**
 * Constants
 * 
 * Platform-wide constants and configuration.
 */

/**
 * Current x402 protocol version
 */
export const X402_VERSION = 1;

/**
 * Default facilitator URL
 */
export const DEFAULT_FACILITATOR_URL = 'https://api.x402platform.com';

/**
 * HTTP headers
 */
export const HEADERS = {
  PAYMENT: 'X-PAYMENT',
  PAYMENT_RESPONSE: 'X-PAYMENT-RESPONSE',
} as const;

/**
 * HTTP status codes
 */
export const STATUS_CODES = {
  PAYMENT_REQUIRED: 402,
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  INTERNAL_ERROR: 500,
} as const;

/**
 * Supported payment schemes
 */
export const SCHEMES = {
  EXACT: 'exact',
  UPTO: 'upto',
} as const;

/**
 * Default timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  /** Default verification timeout */
  VERIFY: 5000,
  /** Default settlement timeout */
  SETTLE: 30000,
  /** Default HTTP request timeout */
  REQUEST: 10000,
  /** Default retry delay */
  RETRY_BASE_DELAY: 1000,
  /** Circuit breaker reset time */
  CIRCUIT_BREAKER_RESET: 30000,
} as const;

/**
 * EIP-712 type definitions for exact scheme
 */
export const EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

/**
 * Payment lifecycle events
 */
export const PAYMENT_EVENTS = {
  INITIATED: 'payment:initiated',
  SIGNED: 'payment:signed',
  VERIFIED: 'payment:verified',
  SETTLED: 'payment:settled',
  FAILED: 'payment:failed',
  REFUNDED: 'payment:refunded',
  STREAM_STARTED: 'payment:stream_started',
  STREAM_CHUNK: 'payment:stream_chunk',
  STREAM_ENDED: 'payment:stream_ended',
} as const;

export type PaymentEventType = typeof PAYMENT_EVENTS[keyof typeof PAYMENT_EVENTS];
