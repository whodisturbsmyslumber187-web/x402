/**
 * Advanced God-Tier Tools
 * 
 * 8 powerful new tools that elevate the MCP server
 * to absolute god-level AI payment infrastructure.
 */

/**
 * Advanced Tool Definitions
 */
export const ADVANCED_TOOLS = {
  x402_smart_pay: {
    name: 'x402_smart_pay',
    description: 'Smart payment — auto-discovers the cheapest healthy provider for a service, verifies its status, compares prices across networks, and executes the optimal payment. Combines discovery + health check + payment in one atomic operation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Service query (e.g., "AI text generation", "weather data")',
        },
        prompt: {
          type: 'string',
          description: 'Optional prompt/query to send to the service',
        },
        maxBudget: {
          type: 'string',
          description: 'Maximum budget in USDC (e.g., "0.10")',
        },
        preferredNetwork: {
          type: 'string',
          description: 'Preferred network (e.g., "base-mainnet"). If not specified, cheapest is auto-selected.',
        },
      },
      required: ['query'],
    },
  },

  x402_subscribe: {
    name: 'x402_subscribe',
    description: 'Set up recurring payment authorization for a service. Creates a subscription-like arrangement where the agent pre-authorizes periodic payments up to a cap.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceUrl: {
          type: 'string',
          description: 'URL of the service to subscribe to',
        },
        maxPerPayment: {
          type: 'string',
          description: 'Maximum USDC per payment (e.g., "0.05")',
        },
        maxTotal: {
          type: 'string',
          description: 'Maximum total USDC for the subscription period',
        },
        intervalMinutes: {
          type: 'number',
          description: 'Payment interval in minutes (e.g., 60 for hourly)',
        },
        durationHours: {
          type: 'number',
          description: 'Total subscription duration in hours',
        },
      },
      required: ['serviceUrl', 'maxPerPayment', 'maxTotal'],
    },
  },

  x402_escrow: {
    name: 'x402_escrow',
    description: 'Create an escrow payment — funds are authorized but only released after the service delivers a verifiable result. Protects against paying for failed service calls.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceUrl: {
          type: 'string',
          description: 'URL of the service',
        },
        amount: {
          type: 'string',
          description: 'Escrow amount in USDC',
        },
        condition: {
          type: 'string',
          description: 'Release condition (e.g., "response contains valid JSON", "HTTP 200")',
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Escrow timeout in seconds (default: 300)',
        },
        body: {
          type: 'object',
          description: 'Optional request body to send',
        },
      },
      required: ['serviceUrl', 'amount'],
    },
  },

  x402_refund_request: {
    name: 'x402_refund_request',
    description: 'Request a refund from a service provider for a previous payment. Tracks refund status and provides receipt.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        txHash: {
          type: 'string',
          description: 'Transaction hash of the original payment',
        },
        reason: {
          type: 'string',
          description: 'Reason for refund request',
        },
        serviceUrl: {
          type: 'string',
          description: 'URL of the service that was paid',
        },
      },
      required: ['txHash', 'reason'],
    },
  },

  x402_audit_trail: {
    name: 'x402_audit_trail',
    description: 'Generate a comprehensive audit trail of all payments, including timestamps, amounts, services, networks, tx hashes, and delegation info. Exportable as structured JSON.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date for audit period (ISO 8601)',
        },
        endDate: {
          type: 'string',
          description: 'End date for audit period (ISO 8601)',
        },
        format: {
          type: 'string',
          enum: ['summary', 'detailed', 'csv'],
          description: 'Output format (default: summary)',
        },
        filterNetwork: {
          type: 'string',
          description: 'Filter by network (optional)',
        },
      },
      required: [],
    },
  },

  x402_network_switch: {
    name: 'x402_network_switch',
    description: 'Switch the active payment network. Shows available networks, their gas costs, and current balances. Supports Base, Ethereum, Arbitrum, and Optimism.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        network: {
          type: 'string',
          enum: ['base-mainnet', 'base-sepolia', 'ethereum-mainnet', 'arbitrum-one', 'optimism-mainnet'],
          description: 'Network to switch to',
        },
        showAll: {
          type: 'boolean',
          description: 'If true, show all networks with balances and gas costs',
        },
      },
      required: [],
    },
  },

  x402_gas_estimate: {
    name: 'x402_gas_estimate',
    description: 'Estimate gas costs for settling a payment on any supported network. Compares costs across Base, Ethereum, Arbitrum, and Optimism.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'string',
          description: 'Payment amount in USDC',
        },
        network: {
          type: 'string',
          description: 'Specific network to estimate, or "all" to compare all networks',
        },
      },
      required: ['amount'],
    },
  },

  x402_portfolio: {
    name: 'x402_portfolio',
    description: 'View USDC balances across all supported networks. Shows a comprehensive portfolio view with total value, per-network breakdown, and recent transaction counts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        includeTestnets: {
          type: 'boolean',
          description: 'Include testnet balances (default: true)',
        },
      },
      required: [],
    },
  },
} as const;

/**
 * Advanced tool category metadata
 */
export const ADVANCED_TOOL_CATEGORY = {
  name: 'Advanced',
  description: 'God-tier tools for smart payments, escrow, subscriptions, portfolio management, and cross-chain operations',
  tools: Object.keys(ADVANCED_TOOLS),
};
