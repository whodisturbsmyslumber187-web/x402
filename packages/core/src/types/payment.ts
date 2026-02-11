/**
 * Payment Types - Core x402 Protocol Types
 * 
 * These types match the x402 protocol specification exactly.
 * See: https://github.com/coinbase/x402
 */

import type { Address, Hex } from 'viem';



/**
 * Payment requirements sent by a resource server
 * This is returned in the body of a 402 response
 */
export interface PaymentRequirements {
  /** Payment scheme (e.g., 'exact') */
  scheme: string;
  
  /** Network identifier (e.g., 'base-mainnet', 'base-sepolia') */
  network: string;
  
  /** Maximum amount required in atomic units (wei for ERC-20) */
  maxAmountRequired: string;
  
  /** URL of the resource being paid for */
  resource: string;
  
  /** Human-readable description of the resource */
  description: string;
  
  /** MIME type of the response */
  mimeType: string;
  
  /** Optional JSON schema for the response */
  outputSchema?: object | null;
  
  /** Address to receive payment */
  payTo: Address;
  
  /** Maximum time in seconds for server response */
  maxTimeoutSeconds: number;
  
  /** Address of the ERC-20 token contract */
  asset: Address;
  
  /** Extra scheme-specific parameters */
  extra?: {
    /** EIP-712 domain name (for 'exact' scheme) */
    name?: string;
    /** EIP-712 domain version (for 'exact' scheme) */
    version?: string;
  } | null;
}

/**
 * Payment Required Response
 * This is the full 402 response body
 */
export interface PaymentRequiredResponse {
  /** x402 protocol version */
  x402Version: number;
  
  /** Array of accepted payment options */
  accepts: PaymentRequirements[];
  
  /** Optional error message */
  error?: string;
}

/**
 * Payment Payload
 * Sent by the client in the X-PAYMENT header (base64 encoded)
 */
export interface PaymentPayload {
  /** x402 protocol version */
  x402Version: number;
  
  /** Payment scheme being used */
  scheme: string;
  
  /** Network being used */
  network: string;
  
  /** Scheme-specific payload */
  payload: ExactSchemePayload | unknown;
}

/**
 * Exact Scheme Payload
 * For EIP-3009 transferWithAuthorization
 */
export interface ExactSchemePayload {
  /** EIP-712 signature */
  signature: Hex;
  
  /** Authorization details */
  authorization: {
    /** Sender address */
    from: Address;
    /** Recipient address */
    to: Address;
    /** Amount in atomic units */
    value: string;
    /** Valid after timestamp */
    validAfter: string;
    /** Valid before timestamp */
    validBefore: string;
    /** Unique nonce */
    nonce: Hex;
  };
}

/**
 * Upto Scheme Payload
 * For metered payments — pays UP TO a maximum based on actual usage.
 * Ideal for LLM token-based pricing, bandwidth metering, etc.
 */
export interface UptoSchemePayload {
  /** EIP-712 signature authorizing up-to maxAmount */
  signature: Hex;
  
  /** Authorization details (same structure as exact, but value = max cap) */
  authorization: {
    /** Sender address */
    from: Address;
    /** Recipient address */
    to: Address;
    /** Maximum authorized amount (cap) in atomic units */
    value: string;
    /** Valid after timestamp */
    validAfter: string;
    /** Valid before timestamp */
    validBefore: string;
    /** Unique nonce */
    nonce: Hex;
  };

  /** Metering metadata */
  metering?: {
    /** Unit of metering (e.g., 'tokens', 'bytes', 'seconds') */
    unit: string;
    /** Price per unit in atomic units */
    pricePerUnit: string;
    /** Maximum units authorized */
    maxUnits: string;
  };
}

/**
 * Payment Lifecycle Event
 * Emitted by the event bus for observability
 */
export interface PaymentEvent {
  /** Event type */
  type: string;
  /** Timestamp */
  timestamp: Date;
  /** Associated URL */
  url?: string;
  /** Amount involved */
  amount?: string;
  /** Network */
  network?: string;
  /** Transaction hash */
  txHash?: string;
  /** Error if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Payment Response
 * Returned in X-PAYMENT-RESPONSE header (base64 encoded)
 */
export interface PaymentResponse {
  /** Whether payment was successful */
  success: boolean;
  
  /** Transaction hash if settled */
  txHash?: Hex;
  
  /** Network ID where payment was settled */
  networkId?: string;
  
  /** Error message if failed */
  error?: string;

  /** Actual amount settled (may differ from maxAmount for upto scheme) */
  actualAmount?: string;
}

