/**
 * Payment Tools
 * 
 * Advanced MCP tools for making x402 payments.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Payment tool definitions
 */
export const PAYMENT_TOOLS: Record<string, Tool> = {
  x402_pay: {
    name: 'x402_pay',
    description: `Make a paid HTTP request to an x402-enabled API endpoint. 
Automatically handles the 402 Payment Required flow:
1. Makes initial request
2. If 402 returned, signs payment authorization
3. Retries with X-PAYMENT header
4. Returns the response data

Use this when you need to access a paid API service.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The full URL of the x402-enabled endpoint',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
          description: 'HTTP method (default: GET)',
        },
        body: {
          type: 'object',
          description: 'Request body for POST/PUT requests (JSON)',
        },
        headers: {
          type: 'object',
          description: 'Additional HTTP headers',
        },
        maxAmount: {
          type: 'string',
          description: 'Maximum amount willing to pay in atomic units (optional safety limit)',
        },
      },
      required: ['url'],
    },
  },

  x402_pay_batch: {
    name: 'x402_pay_batch',
    description: `Execute multiple paid requests in parallel. 
Useful for:
- Fetching data from multiple x402 APIs at once
- Reducing total latency for multi-service workflows
- Staying within a total budget across all requests

Returns results for all requests, including any failures.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        requests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              method: { type: 'string' },
              body: { type: 'object' },
            },
            required: ['url'],
          },
          description: 'Array of requests to execute',
        },
        maxTotalAmount: {
          type: 'string',
          description: 'Maximum total amount for all requests combined',
        },
        stopOnError: {
          type: 'boolean',
          description: 'Stop remaining requests if one fails (default: false)',
        },
      },
      required: ['requests'],
    },
  },

  x402_estimate: {
    name: 'x402_estimate',
    description: `Get the price of an x402 endpoint WITHOUT making payment.
Makes a request to trigger the 402 response and extracts:
- Price in atomic units and formatted
- Payment network and token
- Service description

Use this to check costs before committing to a payment.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The URL to check the price for',
        },
        method: {
          type: 'string',
          description: 'HTTP method to estimate (default: GET)',
        },
      },
      required: ['url'],
    },
  },

  x402_pay_stream: {
    name: 'x402_pay_stream',
    description: `Make a streaming paid request for long-running operations.
Useful for:
- AI model inference with streaming responses
- Large file downloads
- Real-time data feeds

Returns chunks as they arrive.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The streaming endpoint URL',
        },
        body: {
          type: 'object',
          description: 'Request body',
        },
        maxAmount: {
          type: 'string',
          description: 'Maximum amount to pay',
        },
      },
      required: ['url'],
    },
  },
};

export type PaymentToolName = keyof typeof PAYMENT_TOOLS;
