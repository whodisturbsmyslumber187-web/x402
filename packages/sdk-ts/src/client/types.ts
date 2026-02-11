/**
 * Client Types
 */

import type { PaymentRequirements } from '@x402-platform/core';

/**
 * X402 Client configuration
 */
export interface X402ClientConfig {
  /** Private key for signing payments (hex string) */
  privateKey: `0x${string}`;
  
  /** Default network (override per-request) */
  defaultNetwork?: string;
  
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

/**
 * Request options
 */
export interface X402RequestOptions {
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  
  /** Request headers */
  headers?: Record<string, string>;
  
  /** Request body */
  body?: unknown;
  
  /** Max amount willing to pay (default: use server's maxAmountRequired) */
  maxAmount?: string | bigint;
}

/**
 * Response with payment info
 */
export interface X402Response<T = unknown> {
  /** Response data */
  data: T;
  
  /** HTTP status code */
  status: number;
  
  /** Whether payment was made */
  paid: boolean;
  
  /** Amount paid (if paid) */
  amountPaid?: string;
  
  /** Transaction hash (if settled) */
  txHash?: string;
}

/**
 * Payment decision callback
 */
export type PaymentDecisionCallback = (
  requirements: PaymentRequirements
) => boolean | Promise<boolean>;
