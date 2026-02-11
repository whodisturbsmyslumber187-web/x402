/**
 * Server Middleware Types
 */

import type { PaymentRequirements, NetworkId } from '@x402-platform/core';

/**
 * Route-level payment configuration
 */
export interface RoutePaymentConfig {
  /** Amount in atomic units (e.g., "1000" for 0.001 USDC) */
  amount: string | bigint;
  
  /** Token symbol (default: 'USDC') */
  token?: 'USDC';
  
  /** Human-readable description */
  description?: string;
  
  /** Response MIME type (default: 'application/json') */
  mimeType?: string;
  
  /** Max timeout in seconds (default: 60) */
  maxTimeoutSeconds?: number;
}

/**
 * Middleware configuration
 */
export interface X402MiddlewareConfig {
  /** Facilitator URL */
  facilitator: string;

  /** Wallet address to receive payments */
  payTo: `0x${string}`;
  
  /** Network to use (default: 'base-sepolia') */
  network?: NetworkId;
  
  /** Route-specific payment requirements */
  routes: Record<string, RoutePaymentConfig>;
  
  /** Custom error handler */
  onPaymentError?: (error: Error, req: unknown) => void;
}

/**
 * Payment context added to request
 */
export interface PaymentContext {
  /** Whether payment was verified */
  paid: boolean;
  
  /** Payment amount if paid */
  amount?: string;
  
  /** Payer address if paid */
  payer?: string;
  
  /** Transaction hash if settled */
  txHash?: string;
}

/**
 * Extended request with payment context
 */
export interface X402Request {
  x402?: PaymentContext;
}
