/**
 * Payment Schemas - Zod validation schemas
 * 
 * These schemas validate x402 protocol data structures.
 */

import { z } from 'zod';

/**
 * Ethereum address schema
 */
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

/**
 * Hex string schema
 */
export const hexSchema = z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex string');

/**
 * Uint256 as string schema
 */
export const uint256Schema = z.string().regex(/^\d+$/, 'Invalid uint256');

/**
 * Payment Requirements schema
 */
export const paymentRequirementsSchema = z.object({
  scheme: z.string().min(1),
  network: z.string().min(1),
  maxAmountRequired: uint256Schema,
  resource: z.string().url(),
  description: z.string(),
  mimeType: z.string(),
  outputSchema: z.object({}).passthrough().nullable().optional(),
  payTo: addressSchema,
  maxTimeoutSeconds: z.number().positive(),
  asset: addressSchema,
  extra: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
  }).nullable().optional(),
});

/**
 * Exact scheme authorization schema
 */
export const exactAuthorizationSchema = z.object({
  from: addressSchema,
  to: addressSchema,
  value: uint256Schema,
  validAfter: uint256Schema,
  validBefore: uint256Schema,
  nonce: hexSchema,
});

/**
 * Exact scheme payload schema
 */
export const exactSchemePayloadSchema = z.object({
  signature: hexSchema,
  authorization: exactAuthorizationSchema,
});

/**
 * Payment payload schema
 */
export const paymentPayloadSchema = z.object({
  x402Version: z.number().int().positive(),
  scheme: z.string().min(1),
  network: z.string().min(1),
  payload: z.unknown(),
});

/**
 * Payment required response schema
 */
export const paymentRequiredResponseSchema = z.object({
  x402Version: z.number().int().positive(),
  accepts: z.array(paymentRequirementsSchema).min(1),
  error: z.string().optional(),
});

/**
 * Verify request schema
 */
export const verifyRequestSchema = z.object({
  x402Version: z.number().int().positive(),
  paymentHeader: z.string().min(1),
  paymentRequirements: paymentRequirementsSchema,
});

/**
 * Verify response schema
 */
export const verifyResponseSchema = z.object({
  isValid: z.boolean(),
  invalidReason: z.string().nullable(),
});

/**
 * Settle request schema
 */
export const settleRequestSchema = z.object({
  x402Version: z.number().int().positive(),
  paymentHeader: z.string().min(1),
  paymentRequirements: paymentRequirementsSchema,
});

/**
 * Settle response schema
 */
export const settleResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().nullable(),
  txHash: z.string().nullable(),
  networkId: z.string().nullable(),
});

// Type exports from schemas
export type PaymentRequirementsInput = z.input<typeof paymentRequirementsSchema>;
export type PaymentPayloadInput = z.input<typeof paymentPayloadSchema>;
export type VerifyRequestInput = z.input<typeof verifyRequestSchema>;
export type SettleRequestInput = z.input<typeof settleRequestSchema>;
