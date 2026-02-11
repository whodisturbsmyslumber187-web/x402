/**
 * Multi-Agent Delegation Tools
 * 
 * Tools for managing budgets across multiple AI agents.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Delegation tool definitions
 */
export const DELEGATION_TOOLS: Record<string, Tool> = {
  x402_delegate_budget: {
    name: 'x402_delegate_budget',
    description: `Create a delegated budget for another AI agent or sub-task.
Generates a new sub-wallet with:
- Specified spending limit
- Optional expiration time
- Restricted service access (optional)
- Unique delegation ID for tracking

Useful for:
- Spawning sub-agents with their own budgets
- Limiting spending for specific tasks
- Auditing per-task expenses`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Human-readable name for this delegation (e.g., "research-agent")',
        },
        amount: {
          type: 'string',
          description: 'Maximum USDC this delegation can spend',
        },
        expiresIn: {
          type: 'number',
          description: 'Expiration time in seconds (optional)',
        },
        allowedServices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Restrict to specific service URLs (optional)',
        },
        allowedCategories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Restrict to service categories (optional)',
        },
        maxPerRequest: {
          type: 'string',
          description: 'Maximum per single request for this delegation',
        },
      },
      required: ['name', 'amount'],
    },
  },

  x402_revoke_budget: {
    name: 'x402_revoke_budget',
    description: `Revoke a previously delegated budget.
Immediately prevents further spending from the delegation.
Returns:
- Amount spent before revocation
- Amount returned/unspent
- Transaction details

Use when a task is complete or needs to be stopped.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        delegationId: {
          type: 'string',
          description: 'ID of the delegation to revoke',
        },
        reason: {
          type: 'string',
          description: 'Reason for revocation (for audit)',
        },
      },
      required: ['delegationId'],
    },
  },

  x402_list_delegations: {
    name: 'x402_list_delegations',
    description: `List all active budget delegations.
Shows:
- Delegation name and ID
- Budget limit and amount spent
- Creation time and expiration
- Allowed services/categories
- Last activity

Useful for monitoring sub-agent spending.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'expired', 'revoked', 'all'],
          description: 'Filter by delegation status (default: active)',
        },
        sortBy: {
          type: 'string',
          enum: ['created', 'spent', 'remaining', 'name'],
          description: 'Sort delegations by (default: created)',
        },
      },
      required: [],
    },
  },

  x402_delegation_stats: {
    name: 'x402_delegation_stats',
    description: `Get spending statistics for a specific delegation.
Returns detailed analytics:
- Total spent vs budget
- Spending breakdown by service
- Request count and success rate
- Average cost per request
- Timeline of spending

Great for evaluating sub-agent efficiency.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        delegationId: {
          type: 'string',
          description: 'ID of the delegation to analyze',
        },
      },
      required: ['delegationId'],
    },
  },

  x402_transfer_between_delegations: {
    name: 'x402_transfer_between_delegations',
    description: `Transfer budget between delegations.
Move unspent funds from one delegation to another.
Useful for:
- Reallocating budget from completed tasks
- Funding urgent sub-agents
- Balancing across parallel work

Returns updated balances for both delegations.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        fromDelegationId: {
          type: 'string',
          description: 'Source delegation ID',
        },
        toDelegationId: {
          type: 'string',
          description: 'Destination delegation ID',
        },
        amount: {
          type: 'string',
          description: 'Amount to transfer in USDC',
        },
      },
      required: ['fromDelegationId', 'toDelegationId', 'amount'],
    },
  },
};

export type DelegationToolName = keyof typeof DELEGATION_TOOLS;
