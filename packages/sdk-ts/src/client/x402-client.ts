/**
 * X402 Client
 * 
 * Handles the full x402 payment flow automatically:
 * 1. Make initial request
 * 2. If 402, sign payment and retry with X-PAYMENT header
 * 3. Parse X-PAYMENT-RESPONSE from server
 * 
 * God-level features:
 * - Retry with exponential backoff
 * - Circuit breaker for failing services  
 * - Smart payment selection (cheapest option)
 * - Streaming request support
 * - Event bus integration
 * - Full HTTP method support
 */

import {
  type PaymentPayload,
  type PaymentRequiredResponse,
  type PaymentRequirements,
  type PaymentResponse,
  encodePaymentHeader,
  decodePaymentHeader,
  X402_VERSION,
  HEADERS,
  STATUS_CODES,
  withRetry,
  CircuitBreaker,
  getGlobalEventBus,
} from '@x402-platform/core';

import { X402Wallet } from './wallet.js';
import type { X402ClientConfig, X402RequestOptions, X402Response, PaymentDecisionCallback } from './types.js';

/**
 * X402 Client
 * The ultimate AI payment client
 */
export class X402Client {
  private wallet: X402Wallet;
  private config: Required<Omit<X402ClientConfig, 'privateKey'>>;
  private paymentDecision: PaymentDecisionCallback | null = null;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(clientConfig: X402ClientConfig) {
    this.wallet = new X402Wallet(clientConfig.privateKey);
    this.config = {
      defaultNetwork: clientConfig.defaultNetwork ?? 'base-sepolia',
      timeout: clientConfig.timeout ?? 30000,
      fetch: clientConfig.fetch ?? globalThis.fetch.bind(globalThis),
    };
  }

  /**
   * Get the wallet address
   */
  get address(): string {
    return this.wallet.address;
  }

  /**
   * Set payment decision callback
   */
  setPaymentDecision(callback: PaymentDecisionCallback): void {
    this.paymentDecision = callback;
  }

  /**
   * Get or create circuit breaker for a host
   */
  private getCircuitBreaker(url: string): CircuitBreaker {
    const host = new URL(url).host;
    let cb = this.circuitBreakers.get(host);
    if (!cb) {
      cb = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        onStateChange: (from: string, to: string) => {
          console.log(`[X402Client] Circuit breaker for ${host}: ${from} → ${to}`);
        },
      });
      this.circuitBreakers.set(host, cb);
    }
    return cb;
  }

  /**
   * Smart payment selection: pick the cheapest option from accepts[]
   */
  private selectBestPaymentOption(accepts: PaymentRequirements[]): PaymentRequirements {
    if (accepts.length === 1) return accepts[0]!;
    
    // Sort by amount (cheapest first), then prefer L2s over L1
    const sorted = [...accepts].sort((a, b) => {
      const amountDiff = BigInt(a.maxAmountRequired) - BigInt(b.maxAmountRequired);
      if (amountDiff !== 0n) return amountDiff < 0n ? -1 : 1;
      
      // Prefer L2s (Base, Arbitrum, Optimism) over Ethereum mainnet
      const l2Networks = ['base-mainnet', 'base-sepolia', 'arbitrum-one', 'optimism-mainnet'];
      const aIsL2 = l2Networks.includes(a.network);
      const bIsL2 = l2Networks.includes(b.network);
      if (aIsL2 && !bIsL2) return -1;
      if (!aIsL2 && bIsL2) return 1;
      
      return 0;
    });

    return sorted[0]!;
  }

  /**
   * Make an HTTP request with automatic x402 payment handling
   */
  async request<T = unknown>(
    url: string,
    options: X402RequestOptions = {}
  ): Promise<X402Response<T>> {
    const cb = this.getCircuitBreaker(url);
    const eventBus = getGlobalEventBus();

    return cb.execute(async () => {
      return withRetry(
        async () => {
          // Step 1: Make initial request
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers,
          };

          const fetchOptions: RequestInit = {
            method: options.method || 'GET',
            headers,
            signal: AbortSignal.timeout(this.config.timeout),
          };

          if (options.body) {
            fetchOptions.body = JSON.stringify(options.body);
          }

          const response = await this.config.fetch(url, fetchOptions);

          // If not 402, return immediately
          if (response.status !== STATUS_CODES.PAYMENT_REQUIRED) {
            const data = await response.json() as T;
            return {
              data,
              status: response.status,
              paid: false,
            };
          }

          // Step 2: Handle 402 Payment Required
          const paymentRequired = await response.json() as PaymentRequiredResponse;

          if (!paymentRequired.accepts || paymentRequired.accepts.length === 0) {
            throw new Error('Server returned 402 but no payment options');
          }

          // Smart selection: pick best payment option
          const requirements = this.selectBestPaymentOption(paymentRequired.accepts);

          await eventBus.emitInitiated(url, requirements.maxAmountRequired, requirements.network);

          // Check payment decision
          if (this.paymentDecision) {
            const approved = await this.paymentDecision(requirements);
            if (!approved) {
              throw new Error('Payment declined by decision callback');
            }
          }

          // Check max amount
          if (options.maxAmount) {
            const maxWilling = BigInt(options.maxAmount);
            const required = BigInt(requirements.maxAmountRequired);
            if (required > maxWilling) {
              throw new Error(
                `Price ${required} exceeds max willing to pay ${maxWilling}`
              );
            }
          }

          // Step 3: Sign payment
          const schemePayload = await this.wallet.signPaymentAuthorization(requirements);

          await eventBus.emitSigned(url, requirements.maxAmountRequired, requirements.network);

          const paymentPayload: PaymentPayload = {
            x402Version: X402_VERSION,
            scheme: requirements.scheme,
            network: requirements.network,
            payload: schemePayload,
          };

          const paymentHeader = encodePaymentHeader(paymentPayload);

          // Step 4: Retry with payment header
          const paidResponse = await this.config.fetch(url, {
            ...fetchOptions,
            headers: {
              ...headers,
              [HEADERS.PAYMENT]: paymentHeader,
            },
          });

          const data = await paidResponse.json() as T;
          const result: X402Response<T> = {
            data,
            status: paidResponse.status,
            paid: true,
            amountPaid: requirements.maxAmountRequired,
          };

          // Parse payment response header
          const paymentResponseHeader = paidResponse.headers.get(HEADERS.PAYMENT_RESPONSE);
          if (paymentResponseHeader) {
            try {
              const paymentResponse = decodePaymentHeader<PaymentResponse>(paymentResponseHeader);
              if (paymentResponse.txHash) {
                result.txHash = paymentResponse.txHash;
              }
              if (paymentResponse.actualAmount) {
                result.amountPaid = paymentResponse.actualAmount;
              }
            } catch {
              // Ignore decode failures
            }
          }

          return result;
        },
        {
          maxAttempts: 3,
          baseDelayMs: 1000,
          isRetryable: (error: unknown) => {
            // Don't retry on payment declined or price too high
            const msg = error instanceof Error ? error.message : '';
            return !msg.includes('declined') && !msg.includes('exceeds max');
          },
        }
      );
    });
  }

  /**
   * Streaming request support (SSE)
   */
  async requestStream(
    url: string,
    options: X402RequestOptions = {},
    onChunk: (chunk: string) => void
  ): Promise<X402Response<void>> {
    const eventBus = getGlobalEventBus();

    // First, handle payment flow
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...options.headers,
    };

    const fetchOptions: RequestInit = {
      method: options.method || 'POST',
      headers,
      signal: AbortSignal.timeout(this.config.timeout * 3), // Longer timeout for streams
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await this.config.fetch(url, fetchOptions);

    // Handle 402
    if (response.status === STATUS_CODES.PAYMENT_REQUIRED) {
      const paymentRequired = await response.json() as PaymentRequiredResponse;
      const requirements = this.selectBestPaymentOption(paymentRequired.accepts);

      await eventBus.emitInitiated(url, requirements.maxAmountRequired, requirements.network);

      if (this.paymentDecision) {
        const approved = await this.paymentDecision(requirements);
        if (!approved) throw new Error('Payment declined');
      }

      const schemePayload = await this.wallet.signPaymentAuthorization(requirements);
      const paymentPayload: PaymentPayload = {
        x402Version: X402_VERSION,
        scheme: requirements.scheme,
        network: requirements.network,
        payload: schemePayload,
      };

      const paymentHeader = encodePaymentHeader(paymentPayload);

      // Retry with payment
      const paidResponse = await this.config.fetch(url, {
        ...fetchOptions,
        headers: {
          ...headers,
          [HEADERS.PAYMENT]: paymentHeader,
        },
      });

      // Read stream
      if (paidResponse.body) {
        const reader = paidResponse.body.getReader();
        const decoder = new TextDecoder();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            onChunk(text);
          }
        } finally {
          reader.releaseLock();
        }
      }

      return {
        data: undefined as void,
        status: paidResponse.status,
        paid: true,
        amountPaid: paymentRequired.accepts[0]?.maxAmountRequired,
      };
    }

    // No payment needed — just stream
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          onChunk(text);
        }
      } finally {
        reader.releaseLock();
      }
    }

    return {
      data: undefined as void,
      status: response.status,
      paid: false,
    };
  }

  // ================================================
  // Convenience Methods
  // ================================================

  async get<T = unknown>(url: string, options?: Omit<X402RequestOptions, 'method' | 'body'>): Promise<X402Response<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = unknown>(url: string, body?: unknown, options?: Omit<X402RequestOptions, 'method' | 'body'>): Promise<X402Response<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  async put<T = unknown>(url: string, body?: unknown, options?: Omit<X402RequestOptions, 'method' | 'body'>): Promise<X402Response<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  async delete<T = unknown>(url: string, options?: Omit<X402RequestOptions, 'method' | 'body'>): Promise<X402Response<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  async patch<T = unknown>(url: string, body?: unknown, options?: Omit<X402RequestOptions, 'method' | 'body'>): Promise<X402Response<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }

  /**
   * Get circuit breaker status for a host
   */
  getCircuitBreakerStatus(url: string): string {
    return this.getCircuitBreaker(url).getState();
  }

  /**
   * Reset circuit breaker for a host
   */
  resetCircuitBreaker(url: string): void {
    this.getCircuitBreaker(url).reset();
  }
}
