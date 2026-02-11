/**
 * Payment Event Bus
 * 
 * Typed event emitter for payment lifecycle observability.
 * Enables plugins, logging, metrics, and webhooks to subscribe
 * to payment events without coupling to core logic.
 */

import type { PaymentEvent } from '../types/payment.js';
import { PAYMENT_EVENTS, type PaymentEventType } from '../constants.js';

/**
 * Event listener callback
 */
export type PaymentEventListener = (event: PaymentEvent) => void | Promise<void>;

/**
 * Payment Event Bus
 * Central hub for payment lifecycle events
 */
export class PaymentEventBus {
  private listeners: Map<string, Set<PaymentEventListener>> = new Map();
  private globalListeners: Set<PaymentEventListener> = new Set();
  private eventHistory: PaymentEvent[] = [];
  private maxHistorySize: number;

  constructor(options?: { maxHistorySize?: number }) {
    this.maxHistorySize = options?.maxHistorySize ?? 1000;
  }

  /**
   * Subscribe to a specific event type
   */
  on(eventType: PaymentEventType, listener: PaymentEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Subscribe to ALL events
   */
  onAll(listener: PaymentEventListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Emit a payment event
   */
  async emit(event: PaymentEvent): Promise<void> {
    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify specific listeners
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          await listener(event);
        } catch (error) {
          console.error(`[EventBus] Listener error for ${event.type}:`, error);
        }
      }
    }

    // Notify global listeners
    for (const listener of this.globalListeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error(`[EventBus] Global listener error:`, error);
      }
    }
  }

  /**
   * Helper to emit common events
   */
  async emitInitiated(url: string, amount: string, network: string): Promise<void> {
    await this.emit({
      type: PAYMENT_EVENTS.INITIATED,
      timestamp: new Date(),
      url,
      amount,
      network,
    });
  }

  async emitSigned(url: string, amount: string, network: string): Promise<void> {
    await this.emit({
      type: PAYMENT_EVENTS.SIGNED,
      timestamp: new Date(),
      url,
      amount,
      network,
    });
  }

  async emitVerified(url: string, amount: string, network: string): Promise<void> {
    await this.emit({
      type: PAYMENT_EVENTS.VERIFIED,
      timestamp: new Date(),
      url,
      amount,
      network,
    });
  }

  async emitSettled(url: string, amount: string, network: string, txHash: string): Promise<void> {
    await this.emit({
      type: PAYMENT_EVENTS.SETTLED,
      timestamp: new Date(),
      url,
      amount,
      network,
      txHash,
    });
  }

  async emitFailed(url: string, error: string, network?: string): Promise<void> {
    await this.emit({
      type: PAYMENT_EVENTS.FAILED,
      timestamp: new Date(),
      url,
      error,
      network,
    });
  }

  /**
   * Get recent event history
   */
  getHistory(limit?: number): PaymentEvent[] {
    const events = [...this.eventHistory];
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Get history filtered by type
   */
  getHistoryByType(type: PaymentEventType, limit?: number): PaymentEvent[] {
    const events = this.eventHistory.filter(e => e.type === type);
    return limit ? events.slice(-limit) : events;
  }

  /**
   * Get event counts by type
   */
  getCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of this.eventHistory) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

/**
 * Global singleton event bus
 */
let globalEventBus: PaymentEventBus | null = null;

export function getGlobalEventBus(): PaymentEventBus {
  if (!globalEventBus) {
    globalEventBus = new PaymentEventBus();
  }
  return globalEventBus;
}
