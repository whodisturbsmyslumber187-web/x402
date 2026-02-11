/**
 * MCP Server Types
 */

export interface WalletConfig {
  /** Private key for signing payments */
  privateKey: `0x${string}`;
  
  /** Maximum spend per request (atomic units) */
  maxSpendPerRequest?: bigint;
  
  /** Maximum total spend in session (atomic units) */
  maxTotalSpend?: bigint;
}

export interface X402McpServerConfig {
  /** Wallet configuration */
  wallet: WalletConfig;
  
  /** List of trusted x402 service URLs */
  trustedServices?: string[];
  
  /** Enable spending confirmation prompts */
  requireConfirmation?: boolean;
  
  /** Network to use */
  network?: 'base-mainnet' | 'base-sepolia';
}

export interface ServiceInfo {
  url: string;
  description: string;
  price: string;
  priceFormatted: string;
}

export interface SpendingStats {
  totalSpent: bigint;
  requestCount: number;
  lastPayment?: {
    url: string;
    amount: string;
    txHash?: string;
    timestamp: Date;
  };
}

/**
 * Tool result format
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Payment result
 */
export interface PaymentResult {
  success: boolean;
  data?: unknown;
  paid: boolean;
  amount?: string;
  amountFormatted?: string;
  txHash?: string;
  error?: string;
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  count: number;
  services: Array<{
    name: string;
    url: string;
    description: string;
    category: string;
    network: string;
    endpoints: Array<{
      path: string;
      method: string;
      price: string;
      description: string;
    }>;
  }>;
}
