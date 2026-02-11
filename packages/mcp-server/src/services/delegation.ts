/**
 * Delegation Manager
 * 
 * Manages budget delegations for multi-agent workflows.
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address } from 'viem';

export interface Delegation {
  id: string;
  name: string;
  agentId?: string;
  address: Address;
  privateKey: `0x${string}`;
  budget: bigint;
  amount: string;
  spent: bigint;
  maxPerRequest?: bigint;
  allowedServices: string[];
  allowedCategories: string[];
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  status: 'active' | 'expired' | 'revoked' | 'exhausted';
  transactions: DelegationTransaction[];
}

export interface DelegationTransaction {
  id: string;
  serviceUrl: string;
  amount: string;
  timestamp: Date;
  success: boolean;
}

export interface CreateDelegationOptions {
  name?: string;
  agentId?: string;
  amount: string | bigint;
  expiresIn?: number; // seconds
  expiresInHours?: number;
  allowedServices?: string[];
  allowedCategories?: string[];
  maxPerRequest?: string | bigint;
}

export interface DelegationStats {
  delegationId: string;
  name: string;
  budget: string;
  spent: string;
  remaining: string;
  percentUsed: number;
  requestCount: number;
  successRate: number;
  avgCostPerRequest: string;
  byService: { url: string; spent: string; count: number }[];
}

export interface DelegationOverviewStats {
  active: number;
  totalDelegated: string;
  totalSpent: string;
  revoked: number;
  expired: number;
}

/**
 * Delegation Manager
 */
export class DelegationManager {
  private delegations: Map<string, Delegation> = new Map();
  private counter = 0;

  /**
   * Create a new delegation
   */
  create(options: CreateDelegationOptions): Delegation {
    const id = `del_${++this.counter}_${Date.now().toString(36)}`;
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    const delegation: Delegation = {
      id,
      name: options.name ?? options.agentId ?? id,
      agentId: options.agentId ?? options.name,
      address: account.address,
      privateKey,
      budget: BigInt(options.amount),
      amount: BigInt(options.amount).toString(),
      spent: 0n,
      maxPerRequest: options.maxPerRequest ? BigInt(options.maxPerRequest) : undefined,
      allowedServices: options.allowedServices ?? [],
      allowedCategories: options.allowedCategories ?? [],
      createdAt: new Date(),
      expiresAt: new Date(
        Date.now() + (options.expiresIn ?? (options.expiresInHours ? options.expiresInHours * 3600 : 24 * 3600)) * 1000
      ),
      status: 'active',
      transactions: [],
    };

    this.delegations.set(id, delegation);
    return delegation;
  }

  /**
   * Get a delegation by ID
   */
  get(id: string): Delegation | undefined {
    const delegation = this.delegations.get(id);
    if (delegation) {
      this.updateStatus(delegation);
    }
    return delegation;
  }

  /**
   * List all delegations
   */
  list(options?: {
    status?: 'active' | 'expired' | 'revoked' | 'all';
    sortBy?: 'created' | 'spent' | 'remaining' | 'name';
  }): Delegation[] {
    let results = Array.from(this.delegations.values());
    
    // Update statuses
    results.forEach(d => this.updateStatus(d));

    // Filter by status
    if (options?.status && options.status !== 'all') {
      results = results.filter(d => d.status === options.status);
    }

    // Sort
    const sortBy = options?.sortBy ?? 'created';
    results.sort((a, b) => {
      switch (sortBy) {
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'spent':
          return Number(b.spent - a.spent);
        case 'remaining':
          return Number((b.budget - b.spent) - (a.budget - a.spent));
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return results;
  }

  /**
   * Revoke a delegation
   */
  revoke(id: string, _reason?: string): { spent: bigint; returned: bigint } | null {
    const delegation = this.delegations.get(id);
    if (!delegation || delegation.status !== 'active') {
      return null;
    }

    delegation.status = 'revoked';
    delegation.revokedAt = new Date();

    const returned = delegation.budget - delegation.spent;
    return {
      spent: delegation.spent,
      returned,
    };
  }

  /**
   * Record a transaction against a delegation
   */
  recordTransaction(
    id: string, 
    serviceUrl: string, 
    amount: string | bigint,
    success: boolean
  ): boolean {
    const delegation = this.delegations.get(id);
    if (!delegation || delegation.status !== 'active') {
      return false;
    }

    const amountBn = BigInt(amount);
    
    // Update spent amount
    if (success) {
      delegation.spent += amountBn;
    }

    // Record transaction
    delegation.transactions.push({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      serviceUrl,
      amount: amountBn.toString(),
      timestamp: new Date(),
      success,
    });

    // Check if exhausted
    if (delegation.spent >= delegation.budget) {
      delegation.status = 'exhausted';
    }

    return true;
  }

  /**
   * Check if a payment is allowed for a delegation
   */
  canPay(
    id: string, 
    serviceUrl: string, 
    amount: string | bigint
  ): { allowed: boolean; reason?: string } {
    const delegation = this.delegations.get(id);
    if (!delegation) {
      return { allowed: false, reason: 'Delegation not found' };
    }

    this.updateStatus(delegation);
    if (delegation.status !== 'active') {
      return { allowed: false, reason: `Delegation is ${delegation.status}` };
    }

    const amountBn = BigInt(amount);

    // Check budget
    if (delegation.spent + amountBn > delegation.budget) {
      return { allowed: false, reason: 'Would exceed delegation budget' };
    }

    // Check per-request limit
    if (delegation.maxPerRequest && amountBn > delegation.maxPerRequest) {
      return { allowed: false, reason: 'Exceeds per-request limit' };
    }

    // Check allowed services
    if (delegation.allowedServices.length > 0) {
      const allowed = delegation.allowedServices.some(s => serviceUrl.includes(s));
      if (!allowed) {
        return { allowed: false, reason: 'Service not in allowed list' };
      }
    }

    return { allowed: true };
  }

  /**
   * Get statistics for a delegation
   */
  getStats(): DelegationOverviewStats;
  getStats(id: string): DelegationStats | null;
  getStats(id?: string): DelegationStats | DelegationOverviewStats | null {
    if (!id) {
      const all = Array.from(this.delegations.values());
      all.forEach((d) => this.updateStatus(d));
      const active = all.filter((d) => d.status === 'active').length;
      const revoked = all.filter((d) => d.status === 'revoked').length;
      const expired = all.filter((d) => d.status === 'expired').length;
      const totalDelegated = all.reduce((sum, d) => sum + d.budget, 0n);
      const totalSpent = all.reduce((sum, d) => sum + d.spent, 0n);
      return {
        active,
        totalDelegated: totalDelegated.toString(),
        totalSpent: totalSpent.toString(),
        revoked,
        expired,
      };
    }

    const delegation = this.get(id);
    if (!delegation) return null;

    const remaining = delegation.budget - delegation.spent;
    const percentUsed = delegation.budget > 0n 
      ? Number((delegation.spent * 100n) / delegation.budget)
      : 0;

    const successTxs = delegation.transactions.filter(t => t.success);
    
    // Group by service
    const byService = new Map<string, { spent: bigint; count: number }>();
    for (const tx of delegation.transactions) {
      try {
        const host = new URL(tx.serviceUrl).host;
        const current = byService.get(host) ?? { spent: 0n, count: 0 };
        current.spent += BigInt(tx.amount);
        current.count++;
        byService.set(host, current);
      } catch {
        // Skip invalid URLs
      }
    }

    return {
      delegationId: id,
      name: delegation.name,
      budget: this.formatAmount(delegation.budget),
      spent: this.formatAmount(delegation.spent),
      remaining: this.formatAmount(remaining),
      percentUsed,
      requestCount: delegation.transactions.length,
      successRate: delegation.transactions.length > 0
        ? successTxs.length / delegation.transactions.length
        : 1,
      avgCostPerRequest: successTxs.length > 0
        ? this.formatAmount(delegation.spent / BigInt(successTxs.length))
        : '0',
      byService: Array.from(byService.entries()).map(([url, data]) => ({
        url,
        spent: this.formatAmount(data.spent),
        count: data.count,
      })),
    };
  }

  /**
   * Transfer budget between delegations
   */
  transfer(
    fromId: string, 
    toId: string, 
    amount: string | bigint
  ): { success: boolean; error?: string } {
    const from = this.delegations.get(fromId);
    const to = this.delegations.get(toId);

    if (!from) return { success: false, error: 'Source delegation not found' };
    if (!to) return { success: false, error: 'Destination delegation not found' };

    const amountBn = BigInt(amount);
    const available = from.budget - from.spent;

    if (amountBn > available) {
      return { success: false, error: 'Insufficient remaining budget' };
    }

    // Reduce source budget
    from.budget -= amountBn;
    
    // Increase destination budget
    to.budget += amountBn;

    return { success: true };
  }

  /**
   * Update delegation status based on current state
   */
  private updateStatus(delegation: Delegation): void {
    if (delegation.status === 'revoked') return;

    if (delegation.expiresAt && new Date() > delegation.expiresAt) {
      delegation.status = 'expired';
    } else if (delegation.spent >= delegation.budget) {
      delegation.status = 'exhausted';
    }
  }

  /**
   * Format amount as USDC string
   */
  private formatAmount(amount: bigint): string {
    const formatted = Number(amount) / 1_000_000;
    return `${formatted.toFixed(6)} USDC`;
  }
}
