/**
 * Facilitator Types
 * 
 * Types for the facilitator service that handles
 * payment verification and settlement.
 */

import type { PaymentRequirements } from './payment.js';

/**
 * Verification Request
 * Sent to facilitator's /verify endpoint
 */
export interface VerifyRequest {
  /** x402 protocol version */
  x402Version: number;
  
  /** Base64-encoded payment header from client */
  paymentHeader: string;
  
  /** Payment requirements from the resource server */
  paymentRequirements: PaymentRequirements;
}

/**
 * Verification Response
 * Returned from facilitator's /verify endpoint
 */
export interface VerifyResponse {
  /** Whether the payment is valid */
  isValid: boolean;
  
  /** Reason for invalidity (if isValid is false) */
  invalidReason: string | null;
}

/**
 * Settlement Request
 * Sent to facilitator's /settle endpoint
 */
export interface SettleRequest {
  /** x402 protocol version */
  x402Version: number;
  
  /** Base64-encoded payment header from client */
  paymentHeader: string;
  
  /** Payment requirements from the resource server */
  paymentRequirements: PaymentRequirements;
}

/**
 * Settlement Response
 * Returned from facilitator's /settle endpoint
 */
export interface SettleResponse {
  /** Whether settlement was successful */
  success: boolean;
  
  /** Error message (if success is false) */
  error: string | null;
  
  /** Transaction hash of the settlement */
  txHash: string | null;
  
  /** Network ID where settlement occurred */
  networkId: string | null;
}

/**
 * Supported Schemes/Networks Response
 * Returned from facilitator's /supported endpoint
 */
export interface SupportedResponse {
  kinds: Array<{
    scheme: string;
    network: string;
  }>;
}

/**
 * Facilitator configuration
 */
export interface FacilitatorConfig {
  /** Base URL of the facilitator service */
  url: string;
  
  /** Optional API key for authentication */
  apiKey?: string;
  
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Facilitator client interface
 */
export interface IFacilitator {
  /** Verify a payment */
  verify(request: VerifyRequest): Promise<VerifyResponse>;
  
  /** Settle a payment */
  settle(request: SettleRequest): Promise<SettleResponse>;
  
  /** Get supported schemes and networks */
  getSupported(): Promise<SupportedResponse>;
}
