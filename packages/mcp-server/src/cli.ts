#!/usr/bin/env node
/**
 * X402 MCP Server CLI - God Level Edition
 * 
 * Run with: npx x402-mcp-server
 * 
 * Configure in Claude Desktop's .mcp.json:
 * {
 *   "mcpServers": {
 *     "x402": {
 *       "command": "npx",
 *       "args": ["x402-mcp-server"],
 *       "env": {
 *         "WALLET_PRIVATE_KEY": "0x..."
 *       }
 *     }
 *   }
 * }
 */

import { runMcpServer, getServerInfo } from './server.js';

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  const info = getServerInfo();
  console.log(`
X402 MCP Server - ${info.description}
Version: ${info.version}
Total Tools: ${info.totalTools}

USAGE:
  x402-mcp-server [options]

OPTIONS:
  --help, -h     Show this help message
  --info         Show available tools

ENVIRONMENT VARIABLES:
  WALLET_PRIVATE_KEY     Required. Private key for signing payments (0x...)
  MAX_SPEND_PER_REQUEST  Optional. Max USDC per request (atomic units)
  MAX_TOTAL_SPEND        Optional. Max USDC per session (atomic units)
  TRUSTED_SERVICES       Optional. Comma-separated list of trusted service URLs
  NETWORK                Optional. 'base-mainnet' or 'base-sepolia' (default)

EXAMPLE:
  WALLET_PRIVATE_KEY=0x... x402-mcp-server
`);
  process.exit(0);
}

// Show tools info
if (process.argv.includes('--info')) {
  const info = getServerInfo();
  console.log(`
X402 MCP Server Tools
=====================

${Object.entries(info.categories).map(([cat, tools]) => 
  `${cat.toUpperCase()} (${(tools as string[]).length} tools):\n${(tools as string[]).map(t => `  - ${t}`).join('\n')}`
).join('\n\n')}

Total: ${info.totalTools} tools
`);
  process.exit(0);
}

// Load configuration from environment
const privateKey = process.env['WALLET_PRIVATE_KEY'] as `0x${string}`;

if (!privateKey) {
  console.error('Error: WALLET_PRIVATE_KEY environment variable is required');
  console.error('Run with --help for usage information');
  process.exit(1);
}

// Optional configuration
const maxSpendPerRequest = process.env['MAX_SPEND_PER_REQUEST'] 
  ? BigInt(process.env['MAX_SPEND_PER_REQUEST']) 
  : undefined;

const maxTotalSpend = process.env['MAX_TOTAL_SPEND'] 
  ? BigInt(process.env['MAX_TOTAL_SPEND']) 
  : undefined;

const trustedServices = process.env['TRUSTED_SERVICES']
  ? process.env['TRUSTED_SERVICES'].split(',').map(s => s.trim())
  : undefined;

const network = (process.env['NETWORK'] ?? 'base-sepolia') as 'base-mainnet' | 'base-sepolia';

// Run the server
runMcpServer({
  wallet: {
    privateKey,
    maxSpendPerRequest,
    maxTotalSpend,
  },
  trustedServices,
  network,
}).catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
