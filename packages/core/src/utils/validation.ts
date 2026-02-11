/**
 * Validation Utilities
 * 
 * Common validation functions for x402 data.
 */

import { isAddress } from 'viem';
import type { PaymentPayload, PaymentRequirements } from '../types/payment.js';
import { parseAmount } from './encoding.js';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate payment requirements
 */
export function validatePaymentRequirements(
  requirements: PaymentRequirements
): ValidationResult {
  const errors: string[] = [];

  // Validate addresses
  if (!isAddress(requirements.payTo)) {
    errors.push('Invalid payTo address');
  }
  if (!isAddress(requirements.asset)) {
    errors.push('Invalid asset address');
  }

  // Validate amount
  try {
    const amount = parseAmount(requirements.maxAmountRequired);
    if (amount <= 0n) {
      errors.push('maxAmountRequired must be positive');
    }
  } catch {
    errors.push('Invalid maxAmountRequired format');
  }

  // Validate timeout
  if (requirements.maxTimeoutSeconds <= 0) {
    errors.push('maxTimeoutSeconds must be positive');
  }

  // Validate resource URL
  try {
    new URL(requirements.resource);
  } catch {
    errors.push('Invalid resource URL');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate payment payload against requirements
 */
export function validatePayloadAgainstRequirements(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): ValidationResult {
  const errors: string[] = [];

  // Version check
  if (payload.x402Version !== 1) {
    errors.push(`Unsupported x402 version: ${payload.x402Version}`);
  }

  // Scheme must match
  if (payload.scheme !== requirements.scheme) {
    errors.push(`Scheme mismatch: expected ${requirements.scheme}, got ${payload.scheme}`);
  }

  // Network must match
  if (payload.network !== requirements.network) {
    errors.push(`Network mismatch: expected ${requirements.network}, got ${payload.network}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate timestamp is within bounds
 */
export function isTimestampValid(
  validAfter: string | bigint,
  validBefore: string | bigint,
  currentTime?: number
): boolean {
  const now = BigInt(currentTime ?? Math.floor(Date.now() / 1000));
  const after = typeof validAfter === 'string' ? BigInt(validAfter) : validAfter;
  const before = typeof validBefore === 'string' ? BigInt(validBefore) : validBefore;
  
  return now >= after && now <= before;
}

/**
 * Check if amount is sufficient
 */
export function isAmountSufficient(
  paymentAmount: string | bigint,
  requiredAmount: string | bigint
): boolean {
  const payment = typeof paymentAmount === 'string' ? BigInt(paymentAmount) : paymentAmount;
  const required = typeof requiredAmount === 'string' ? BigInt(requiredAmount) : requiredAmount;
  
  return payment >= required;
}
