/**
 * X402 MCP Server
 * 
 * Model Context Protocol server that enables AI agents (like Claude)
 * to discover and pay for x402-enabled services.
 */

export * from './server.js';
export * from './tools/index.js';
export * from './types.js';
export { TOOL_HANDLERS, createToolContext } from './handlers/index.js';
export {
  WalletManager,
  ServiceRegistry,
  DelegationManager,
} from './services/index.js';
