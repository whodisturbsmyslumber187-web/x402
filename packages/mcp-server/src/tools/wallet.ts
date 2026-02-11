/**
 * Wallet Tools
 * 
 * Tools for managing the x402 wallet and viewing spending.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Wallet tool definitions
 */
export const WALLET_TOOLS: Record<string, Tool> = {
  x402_wallet_balance: {
    name: 'x402_wallet_balance',
    description: `Check the USDC balance of the x402 wallet.
Returns:
- Balance in atomic units and human-readable format
- Balance on each supported network
- Wallet address

Use this to verify you have sufficient funds before making requests.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        network: {
          type: 'string',
          enum: ['base-mainnet', 'base-sepolia', 'all'],
          description: 'Network to check (default: all)',
        },
      },
      required: [],
    },
  },

  x402_wallet_history: {
    name: 'x402_wallet_history',
    description: `Get the transaction history of x402 payments.
Returns a list of past payments with:
- Service URL paid
- Amount paid
- Transaction hash
- Timestamp
- Success/failure status

Useful for auditing and tracking spending.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of transactions to return (default: 20)',
        },
        since: {
          type: 'string',
          description: 'ISO timestamp to filter from',
        },
        serviceUrl: {
          type: 'string',
          description: 'Filter by specific service URL',
        },
        network: {
          type: 'string',
          description: 'Filter by network',
        },
      },
      required: [],
    },
  },

  x402_wallet_fund: {
    name: 'x402_wallet_fund',
    description: `Request testnet USDC for the wallet (Base Sepolia only).
Uses a faucet to get free testnet tokens for development/testing.
Returns:
- Amount received
- Transaction hash
- New balance

Note: Only works on testnet. Rate limited to prevent abuse.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'string',
          description: 'Amount of testnet USDC to request (default: "10")',
        },
      },
      required: [],
    },
  },

  x402_spending_stats: {
    name: 'x402_spending_stats',
    description: `Get detailed spending analytics and statistics.
Returns comprehensive stats:
- Total spent (all time, today, this week, this month)
- Spending by service/category
- Average cost per request
- Most used services
- Budget utilization
- Spending trends

Great for monitoring and optimizing costs.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'all'],
          description: 'Time period for stats (default: all)',
        },
        groupBy: {
          type: 'string',
          enum: ['service', 'category', 'day', 'hour'],
          description: 'How to group the statistics',
        },
      },
      required: [],
    },
  },

  x402_set_budget: {
    name: 'x402_set_budget',
    description: `Set spending limits and budget controls.
Configure:
- Maximum spend per request
- Maximum spend per hour/day
- Service-specific limits
- Auto-approve threshold

Returns confirmation of new budget settings.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        maxPerRequest: {
          type: 'string',
          description: 'Maximum USDC per single request (e.g., "1.00")',
        },
        maxPerHour: {
          type: 'string',
          description: 'Maximum USDC per hour',
        },
        maxPerDay: {
          type: 'string',
          description: 'Maximum USDC per day',
        },
        autoApproveUnder: {
          type: 'string',
          description: 'Auto-approve payments under this amount',
        },
        trustedServices: {
          type: 'array',
          items: { type: 'string' },
          description: 'URLs to always trust and auto-approve',
        },
      },
      required: [],
    },
  },
};

export type WalletToolName = keyof typeof WALLET_TOOLS;
