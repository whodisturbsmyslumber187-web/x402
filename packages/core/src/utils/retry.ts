/**
 * Retry & Resilience Utilities
 * 
 * Exponential backoff, circuit breaker, and rate limiter
 * for robust payment infrastructure.
 */

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Jitter factor 0-1 (default: 0.1) */
  jitter?: number;
  /** Optional predicate to decide if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Called on each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitter = 0.1,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      const jitterAmount = exponentialDelay * jitter * (Math.random() * 2 - 1);
      const delay = Math.min(exponentialDelay + jitterAmount, maxDelayMs);

      onRetry?.(attempt, error, delay);

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Circuit Breaker States
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit Breaker Options
 */
export interface CircuitBreakerOptions {
  /** Failure threshold before opening (default: 5) */
  failureThreshold?: number;
  /** Time to wait before half-open attempt in ms (default: 30000) */
  resetTimeoutMs?: number;
  /** Number of successes in half-open before closing (default: 2) */
  successThreshold?: number;
  /** Called on state change */
  onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;
}

/**
 * Circuit Breaker
 * Prevents repeated calls to failing services
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly successThreshold: number;
  private readonly onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.successThreshold = options.successThreshold ?? 2;
    this.onStateChange = options.onStateChange;
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.transition('half-open');
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker is OPEN. Will retry after ${this.resetTimeoutMs}ms.`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transition('closed');
      }
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.transition('open');
    } else if (this.failureCount >= this.failureThreshold) {
      this.transition('open');
    }
  }

  private transition(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === 'half-open') {
      this.successCount = 0;
    }

    this.onStateChange?.(oldState, newState);
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.transition('closed');
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Token Bucket Rate Limiter
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(options: { maxTokens: number; refillRatePerSecond: number }) {
    this.maxTokens = options.maxTokens;
    this.tokens = options.maxTokens;
    this.refillRate = options.refillRatePerSecond;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token. Returns true if allowed.
   */
  tryConsume(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  /**
   * Wait until a token is available, then consume it
   */
  async waitAndConsume(tokens = 1): Promise<void> {
    while (!this.tryConsume(tokens)) {
      const waitTime = (tokens - this.tokens) / this.refillRate * 1000;
      await sleep(Math.max(waitTime, 50));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
