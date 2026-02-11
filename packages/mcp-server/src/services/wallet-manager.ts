/**
 * Wallet Manager Service
 * 
 * Handles wallet operations, balance checking, and transaction history.
 */

import {
  createPublicClient,
  http,
  formatUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getNetwork, getAllNetworks, type NetworkId } from '@x402-platform/core';

// USDC ERC20 ABI (minimal for balance)
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

export interface WalletBalance {
  network: NetworkId;
  networkName: string;
  balance: string;
  balanceFormatted: string;
  token: string;
}

export interface TransactionRecord {
  id: string;
  serviceUrl: string;
  amount: string;
  amountFormatted: string;
  txHash: string | null;
  network: NetworkId;
  timestamp: Date;
  success: boolean;
  delegationId?: string;
}

export interface SpendingStats {
  totalSpent: bigint;
  totalSpentFormatted: string;
  requestCount: number;
  successRate: number;
  avgCostPerRequest: string;
  topServices: { url: string; spent: string; count: number }[];
  spendingByPeriod: {
    today: string;
    thisWeek: string;
    thisMonth: string;
  };
}

export interface BudgetConfig {
  maxPerRequest?: bigint;
  maxPerHour?: bigint;
  maxPerDay?: bigint;
  autoApproveUnder?: bigint;
  trustedServices: string[];
}

/**
 * Wallet Manager
 */
export class WalletManager {
  private address: Address;
  private transactions: TransactionRecord[] = [];
  private hourlySpend: Map<string, bigint> = new Map();
  private dailySpend: Map<string, bigint> = new Map();
  private budgetConfig: BudgetConfig = {
    trustedServices: [],
  };

  constructor(privateKey: `0x${string}`) {
    const account = privateKeyToAccount(privateKey);
    this.address = account.address;
  }

  /**
   * Get wallet address
   */
  getAddress(): Address {
    return this.address;
  }

  /**
   * Get balance on a specific network
   */
  async getBalance(networkId: NetworkId): Promise<WalletBalance> {
    const network = getNetwork(networkId);
    const client = createPublicClient({
      chain: network.chain,
      transport: http(network.rpcUrl),
    });

    const balance = await client.readContract({
      address: network.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.address],
    });

    return {
      network: networkId,
      networkName: network.name,
      balance: balance.toString(),
      balanceFormatted: formatUnits(balance, 6),
      token: 'USDC',
    };
  }

  /**
   * Get balances on all networks
   */
  async getAllBalances(): Promise<WalletBalance[]> {
    const networks = getAllNetworks();
    const balances = await Promise.all(
      networks.map(n => this.getBalance(n.id as NetworkId))
    );
    return balances;
  }

  /**
   * Record a transaction
   */
  recordTransaction(tx: Omit<TransactionRecord, 'id' | 'timestamp'>): void {
    const record: TransactionRecord = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };
    
    this.transactions.unshift(record);

    // Update spending trackers
    const amount = BigInt(tx.amount);
    const hourKey = new Date().toISOString().slice(0, 13);
    const dayKey = new Date().toISOString().slice(0, 10);
    
    this.hourlySpend.set(hourKey, (this.hourlySpend.get(hourKey) ?? 0n) + amount);
    this.dailySpend.set(dayKey, (this.dailySpend.get(dayKey) ?? 0n) + amount);
  }

  /**
   * Get transaction history
   */
  getHistory(options?: {
    limit?: number;
    since?: Date;
    serviceUrl?: string;
    network?: NetworkId;
    delegationId?: string;
  }): TransactionRecord[] {
    let result = [...this.transactions];

    if (options?.since) {
      result = result.filter(tx => tx.timestamp >= options.since!);
    }
    if (options?.serviceUrl) {
      result = result.filter(tx => tx.serviceUrl.includes(options.serviceUrl!));
    }
    if (options?.network) {
      result = result.filter(tx => tx.network === options.network);
    }
    if (options?.delegationId) {
      result = result.filter(tx => tx.delegationId === options.delegationId);
    }

    return result.slice(0, options?.limit ?? 20);
  }

  /**
   * Get spending statistics
   */
  getSpendingStats(period?: 'today' | 'week' | 'month' | 'all'): SpendingStats {
    const now = new Date();
    let filtered = this.transactions;

    if (period === 'today') {
      filtered = filtered.filter(tx => 
        tx.timestamp.toDateString() === now.toDateString()
      );
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(tx => tx.timestamp >= weekAgo);
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(tx => tx.timestamp >= monthAgo);
    }

    const totalSpent = filtered.reduce(
      (sum, tx) => sum + BigInt(tx.amount),
      0n
    );
    const successCount = filtered.filter(tx => tx.success).length;
    
    // Group by service
    const byService = new Map<string, { spent: bigint; count: number }>();
    for (const tx of filtered) {
      const host = new URL(tx.serviceUrl).host;
      const current = byService.get(host) ?? { spent: 0n, count: 0 };
      current.spent += BigInt(tx.amount);
      current.count++;
      byService.set(host, current);
    }

    const topServices = Array.from(byService.entries())
      .sort((a, b) => (b[1].spent > a[1].spent ? 1 : -1))
      .slice(0, 5)
      .map(([url, data]) => ({
        url,
        spent: formatUnits(data.spent, 6),
        count: data.count,
      }));

    // Calculate period totals
    const todayKey = now.toISOString().slice(0, 10);
    const todaySpent = this.dailySpend.get(todayKey) ?? 0n;

    let weekSpent = 0n;
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      weekSpent += this.dailySpend.get(key) ?? 0n;
    }

    let monthSpent = 0n;
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      monthSpent += this.dailySpend.get(key) ?? 0n;
    }

    return {
      totalSpent,
      totalSpentFormatted: formatUnits(totalSpent, 6),
      requestCount: filtered.length,
      successRate: filtered.length > 0 ? successCount / filtered.length : 1,
      avgCostPerRequest: filtered.length > 0 
        ? formatUnits(totalSpent / BigInt(filtered.length), 6)
        : '0',
      topServices,
      spendingByPeriod: {
        today: formatUnits(todaySpent, 6),
        thisWeek: formatUnits(weekSpent, 6),
        thisMonth: formatUnits(monthSpent, 6),
      },
    };
  }

  /**
   * Set budget configuration
   */
  setBudgetConfig(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config };
  }

  /**
   * Get budget configuration
   */
  getBudgetConfig(): BudgetConfig {
    return { ...this.budgetConfig };
  }

  /**
   * Check if payment is within budget
   */
  isWithinBudget(amount: bigint, serviceUrl: string): { 
    allowed: boolean; 
    reason?: string;
  } {
    const config = this.budgetConfig;

    // Check per-request limit
    if (config.maxPerRequest && amount > config.maxPerRequest) {
      return { 
        allowed: false, 
        reason: `Amount ${formatUnits(amount, 6)} exceeds per-request limit of ${formatUnits(config.maxPerRequest, 6)}` 
      };
    }

    // Check hourly limit
    if (config.maxPerHour) {
      const hourKey = new Date().toISOString().slice(0, 13);
      const hourlyTotal = (this.hourlySpend.get(hourKey) ?? 0n) + amount;
      if (hourlyTotal > config.maxPerHour) {
        return { 
          allowed: false, 
          reason: `Would exceed hourly limit of ${formatUnits(config.maxPerHour, 6)}` 
        };
      }
    }

    // Check daily limit
    if (config.maxPerDay) {
      const dayKey = new Date().toISOString().slice(0, 10);
      const dailyTotal = (this.dailySpend.get(dayKey) ?? 0n) + amount;
      if (dailyTotal > config.maxPerDay) {
        return { 
          allowed: false, 
          reason: `Would exceed daily limit of ${formatUnits(config.maxPerDay, 6)}` 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Should auto-approve this payment?
   */
  shouldAutoApprove(amount: bigint, serviceUrl: string): boolean {
    const config = this.budgetConfig;
    
    // Check trusted services
    if (config.trustedServices.some(s => serviceUrl.includes(s))) {
      return true;
    }

    // Check auto-approve threshold
    if (config.autoApproveUnder && amount <= config.autoApproveUnder) {
      return true;
    }

    return false;
  }
}
