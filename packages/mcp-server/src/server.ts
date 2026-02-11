/**
 * X402 MCP Server
 * 
 * Model Context Protocol server providing 26 AI payment tools.
 * Enables AI agents to discover, evaluate, and pay for services autonomously.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ALL_TOOLS, ALL_CATEGORIES, TOTAL_TOOLS } from './tools/index.js';
import { TOOL_HANDLERS, createToolContext } from './handlers/index.js';

export interface MpcServerRunConfig {
  wallet?: {
    privateKey: `0x${string}`;
    maxSpendPerRequest?: bigint;
    maxTotalSpend?: bigint;
  };
  trustedServices?: string[];
  network?: string;
}

export function getServerInfo() {
  const categories: Record<string, string[]> = {};
  for (const category of ALL_CATEGORIES) {
    const tools = Object.keys(ALL_TOOLS).filter((toolName) =>
      toolName.includes(category.name.toLowerCase()) ||
      (category.name === 'Payment' && toolName.startsWith('x402_') && !toolName.includes('wallet'))
    );
    categories[category.name] = tools;
  }

  return {
    name: 'x402-payment-server',
    version: '3.0.0',
    description: 'MCP tools for x402 payments, discovery, wallet and delegation',
    totalTools: TOTAL_TOOLS,
    categories,
  };
}

/**
 * Create and configure the MCP server
 */
export function createX402McpServer() {
  const server = new Server(
    {
      name: 'x402-payment-server',
      version: '3.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize tool context
  let ctx: ReturnType<typeof createToolContext> | null = null;

  function getContext() {
    if (!ctx) {
      ctx = createToolContext();
    }
    return ctx;
  }

  // List all available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.values(ALL_TOOLS).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, (async (request: { params: { name: string; arguments?: unknown } }) => {
    const { name, arguments: args } = request.params;

    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Unknown tool: ${name}. Available tools: ${Object.keys(ALL_TOOLS).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const context = getContext();
      return await handler(args as Record<string, unknown>, context);
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }) as any);

  return server;
}

/**
 * Run the MCP server with stdio transport
 */
export async function runMcpServer(config?: MpcServerRunConfig) {
  if (config?.wallet?.privateKey) {
    process.env['WALLET_PRIVATE_KEY'] = config.wallet.privateKey;
  }
  if (config?.network) {
    process.env['DEFAULT_NETWORK'] = config.network;
  }

  const server = createX402McpServer();
  const transport = new StdioServerTransport();

  // Log server info to stderr (stdout is reserved for MCP protocol)
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║              X402 MCP Payment Server v3.0.0                 ║
╠══════════════════════════════════════════════════════════════╣
║  Tools: ${String(TOTAL_TOOLS).padEnd(52)}║
║  Categories:                                                ║${ALL_CATEGORIES.map(c => `
║    ${(c.name + ':').padEnd(14)}${String(c.count).padEnd(39)}║`).join('')}
╠══════════════════════════════════════════════════════════════╣
║  🚀 Ready for AI agent connections                          ║
╚══════════════════════════════════════════════════════════════╝
  `);

  await server.connect(transport);
}
