/**
 * Payment Verifier
 * 
 * Verifies x402 payment payloads against requirements.
 * Supports both 'exact' and 'upto' schemes.
 * Includes nonce deduplication cache for replay protection.
 * Sub-50ms target for verification latency.
 */

import {
  createPublicClient,
  http,
  type Address,
  verifyTypedData,
} from 'viem';

import {
  type PaymentPayload,
  type PaymentRequirements,
  type ExactSchemePayload,
  type UptoSchemePayload,
  type NetworkId,
  getNetwork,
  decodePaymentHeader,
  isTimestampValid,
  isAmountSufficient,
  EIP712_TYPES,
  SCHEMES,
  getGlobalEventBus,
} from '@x402-platform/core';

/**
 * Nonce cache entry with TTL
 */
interface NonceCacheEntry {
  nonce: string;
  expiresAt: number;
}

/**
 * Verification result
 */
export interface VerificationResult {
  isValid: boolean;
  invalidReason: string | null;
  /** Verification latency in ms */
  latencyMs?: number;
  /** Decoded payload for downstream use */
  decodedPayload?: PaymentPayload;
}

/**
 * Verification metrics
 */
export interface VerifierMetrics {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  averageLatencyMs: number;
  nonceCacheSize: number;
  replayAttemptsBlocked: number;
}

/**
 * Payment Verifier
 * Handles payment verification with nonce dedup and multi-scheme support
 */
export class PaymentVerifier {
  private clients: Map<string, ReturnType<typeof createPublicClient>> = new Map();
  private nonceCache: Map<string, NonceCacheEntry> = new Map();
  private nonceCacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Metrics
  private metrics: VerifierMetrics = {
    totalVerifications: 0,
    successfulVerifications: 0,
    failedVerifications: 0,
    averageLatencyMs: 0,
    nonceCacheSize: 0,
    replayAttemptsBlocked: 0,
  };

  constructor(
    private rpcUrls: Record<string, string> = {},
    options?: {
      /** Nonce cache TTL in ms (default: 5 minutes) */
      nonceCacheTtlMs?: number;
      /** Nonce cache cleanup interval in ms (default: 60 seconds) */
      cleanupIntervalMs?: number;
    }
  ) {
    const cleanupMs = options?.cleanupIntervalMs ?? 60_000;
    this.nonceCacheCleanupInterval = setInterval(() => this.cleanupNonceCache(), cleanupMs);
  }

  /**
   * Get or create a public client for a network
   */
  private getClient(networkId: string) {
    let client = this.clients.get(networkId);
    if (!client) {
      const network = getNetwork(networkId as NetworkId);
      const rpcUrl = this.rpcUrls[networkId] || network.rpcUrl;

      client = createPublicClient({
        chain: network.chain,
        transport: http(rpcUrl),
      });
      this.clients.set(networkId, client);
    }
    return client;
  }

  /**
   * Check nonce uniqueness (replay protection)
   */
  private checkNonce(nonce: string, networkId: string): boolean {
    const key = `${networkId}:${nonce}`;
    if (this.nonceCache.has(key)) {
      this.metrics.replayAttemptsBlocked++;
      return false;
    }
    return true;
  }

  /**
   * Record a used nonce
   */
  private recordNonce(nonce: string, networkId: string, ttlMs = 300_000): void {
    const key = `${networkId}:${nonce}`;
    this.nonceCache.set(key, {
      nonce,
      expiresAt: Date.now() + ttlMs,
    });
    this.metrics.nonceCacheSize = this.nonceCache.size;
  }

  /**
   * Clean up expired nonces
   */
  private cleanupNonceCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.nonceCache.entries()) {
      if (entry.expiresAt <= now) {
        this.nonceCache.delete(key);
      }
    }
    this.metrics.nonceCacheSize = this.nonceCache.size;
  }

  /**
   * Verify a payment against requirements
   */
  async verify(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): Promise<VerificationResult> {
    const startTime = performance.now();
    this.metrics.totalVerifications++;

    try {
      // 1. Decode the payment header
      const paymentPayload = decodePaymentHeader<PaymentPayload>(paymentHeader);

      // 2. Basic validation
      if (paymentPayload.x402Version !== 1) {
        return this.fail(`Unsupported x402 version: ${paymentPayload.x402Version}`, startTime);
      }

      if (paymentPayload.scheme !== paymentRequirements.scheme) {
        return this.fail(
          `Scheme mismatch: expected ${paymentRequirements.scheme}, got ${paymentPayload.scheme}`,
          startTime
        );
      }

      if (paymentPayload.network !== paymentRequirements.network) {
        return this.fail(
          `Network mismatch: expected ${paymentRequirements.network}, got ${paymentPayload.network}`,
          startTime
        );
      }

      // 3. Dispatch to scheme-specific verification
      let result: VerificationResult;
      
      switch (paymentPayload.scheme) {
        case SCHEMES.EXACT:
          result = await this.verifyExactScheme(
            paymentPayload.payload as ExactSchemePayload,
            paymentRequirements
          );
          break;
        case SCHEMES.UPTO:
          result = await this.verifyUptoScheme(
            paymentPayload.payload as UptoSchemePayload,
            paymentRequirements
          );
          break;
        default:
          result = this.fail(`Unsupported scheme: ${paymentPayload.scheme}`, startTime);
      }

      // Attach decoded payload and latency
      result.latencyMs = performance.now() - startTime;
      if (result.isValid) {
        result.decodedPayload = paymentPayload;
      }

      // Update metrics
      this.updateMetrics(result);

      // Emit event
      const eventBus = getGlobalEventBus();
      if (result.isValid) {
        await eventBus.emitVerified(
          paymentRequirements.resource,
          paymentRequirements.maxAmountRequired,
          paymentRequirements.network
        );
      }

      return result;
    } catch (error) {
      const result = this.fail(
        error instanceof Error ? error.message : 'Unknown verification error',
        startTime
      );
      this.updateMetrics(result);
      return result;
    }
  }

  /**
   * Verify an 'exact' scheme payment
   */
  private async verifyExactScheme(
    payload: ExactSchemePayload,
    requirements: PaymentRequirements
  ): Promise<VerificationResult> {
    const { authorization, signature } = payload;

    // Check nonce uniqueness (replay prevention)
    if (!this.checkNonce(authorization.nonce, requirements.network)) {
      return { isValid: false, invalidReason: 'Nonce already used (replay detected)' };
    }

    // Validate recipient
    if (authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return {
        isValid: false,
        invalidReason: `Recipient mismatch: expected ${requirements.payTo}, got ${authorization.to}`,
      };
    }

    // Validate amount (must be >= maxAmountRequired)
    if (!isAmountSufficient(authorization.value, requirements.maxAmountRequired)) {
      return {
        isValid: false,
        invalidReason: `Insufficient amount: ${authorization.value} < ${requirements.maxAmountRequired}`,
      };
    }

    // Validate timestamps
    if (!isTimestampValid(authorization.validAfter, authorization.validBefore)) {
      return {
        isValid: false,
        invalidReason: 'Authorization has expired or is not yet valid',
      };
    }

    // Verify EIP-712 signature
    try {
      const network = getNetwork(requirements.network as NetworkId);
      const domain = {
        name: requirements.extra?.name ?? 'USD Coin',
        version: requirements.extra?.version ?? '2',
        chainId: network.chain.id,
        verifyingContract: requirements.asset as Address,
      };

      const valid = await verifyTypedData({
        address: authorization.from as Address,
        domain,
        types: {
          TransferWithAuthorization: [...EIP712_TYPES.TransferWithAuthorization],
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from: authorization.from as Address,
          to: authorization.to as Address,
          value: BigInt(authorization.value),
          validAfter: BigInt(authorization.validAfter),
          validBefore: BigInt(authorization.validBefore),
          nonce: authorization.nonce as `0x${string}`,
        },
        signature: signature as `0x${string}`,
      });

      if (!valid) {
        return { isValid: false, invalidReason: 'Invalid EIP-712 signature' };
      }
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Signature verification failed: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }

    // Check on-chain balance
    try {
      const client = this.getClient(requirements.network);
      const balance = await client.readContract({
        address: requirements.asset as Address,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [authorization.from as Address],
      });

      if (balance < BigInt(authorization.value)) {
        return {
          isValid: false,
          invalidReason: `Insufficient balance: ${balance} < ${authorization.value}`,
        };
      }
    } catch (error) {
      // Balance check failure is not a hard block — log and proceed
      console.warn('[Verifier] Balance check failed (proceeding):', error);
    }

    // Record nonce as used
    this.recordNonce(authorization.nonce, requirements.network);

    return { isValid: true, invalidReason: null };
  }

  /**
   * Verify an 'upto' scheme payment
   * Similar to exact, but allows the server to settle for LESS than the authorized max.
   */
  private async verifyUptoScheme(
    payload: UptoSchemePayload,
    requirements: PaymentRequirements
  ): Promise<VerificationResult> {
    // Upto uses the same authorization structure as exact,
    // but the value represents the MAXIMUM the server can charge.
    // Actual amount charged is determined at settlement time.
    return this.verifyExactScheme(
      {
        signature: payload.signature,
        authorization: payload.authorization,
      },
      requirements
    );
  }

  /**
   * Helper to create a failure result
   */
  private fail(reason: string, _startTime?: number): VerificationResult {
    return { isValid: false, invalidReason: reason };
  }

  /**
   * Update metrics
   */
  private updateMetrics(result: VerificationResult): void {
    if (result.isValid) {
      this.metrics.successfulVerifications++;
    } else {
      this.metrics.failedVerifications++;
    }
    if (result.latencyMs) {
      const total = this.metrics.averageLatencyMs * (this.metrics.totalVerifications - 1);
      this.metrics.averageLatencyMs = (total + result.latencyMs) / this.metrics.totalVerifications;
    }
  }

  /**
   * Get metrics snapshot
   */
  getMetrics(): VerifierMetrics {
    return { ...this.metrics };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.nonceCacheCleanupInterval) {
      clearInterval(this.nonceCacheCleanupInterval);
      this.nonceCacheCleanupInterval = null;
    }
    this.nonceCache.clear();
  }
}

/**
 * Create verifiers for all configured networks
 */
export function createVerifiers(
  rpcUrls?: Record<string, string>
): PaymentVerifier {
  return new PaymentVerifier(rpcUrls);
}
