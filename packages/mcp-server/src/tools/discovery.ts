/**
 * Discovery Tools
 * 
 * Tools for finding and evaluating x402 services.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Discovery tool definitions
 */
export const DISCOVERY_TOOLS: Record<string, Tool> = {
  x402_discover: {
    name: 'x402_discover',
    description: `Search for x402-enabled services by category or keyword.
Returns a list of services matching your criteria with:
- Service URL and name
- Description of what it does
- Pricing information
- Health status

Categories include: ai, data, tools, storage, compute, crypto, social`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (keywords or natural language)',
        },
        category: {
          type: 'string',
          enum: ['ai', 'data', 'tools', 'storage', 'compute', 'crypto', 'social', 'all'],
          description: 'Filter by category (default: all)',
        },
        maxPrice: {
          type: 'string',
          description: 'Maximum price per request in USDC (e.g., "0.01")',
        },
        network: {
          type: 'string',
          enum: ['base-mainnet', 'base-sepolia', 'any'],
          description: 'Filter by blockchain network',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: [],
    },
  },

  x402_service_info: {
    name: 'x402_service_info',
    description: `Get detailed information about a specific x402 service.
Returns comprehensive details:
- Full API documentation
- All available endpoints and their prices
- Supported parameters
- Example requests/responses
- Health and uptime statistics
- User ratings if available`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'Base URL of the x402 service',
        },
      },
      required: ['url'],
    },
  },

  x402_compare_prices: {
    name: 'x402_compare_prices',
    description: `Compare prices across multiple providers for similar services.
Useful for:
- Finding the cheapest AI inference provider
- Comparing data API costs
- Optimizing spending across providers

Returns sorted list with price, quality indicators, and recommendations.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        serviceType: {
          type: 'string',
          description: 'Type of service to compare (e.g., "llm-inference", "image-generation", "web-scraping")',
        },
        providers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific provider URLs to compare (optional)',
        },
        sortBy: {
          type: 'string',
          enum: ['price', 'speed', 'quality', 'reliability'],
          description: 'Sort results by (default: price)',
        },
      },
      required: ['serviceType'],
    },
  },

  x402_health_check: {
    name: 'x402_health_check',
    description: `Check the health and availability of an x402 service.
Returns:
- Online/offline status
- Response time (latency)
- Recent uptime percentage
- Last successful request time
- Any error messages

Use this before making important paid requests.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'URL of the service to check',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 5000)',
        },
      },
      required: ['url'],
    },
  },
};

export type DiscoveryToolName = keyof typeof DISCOVERY_TOOLS;
