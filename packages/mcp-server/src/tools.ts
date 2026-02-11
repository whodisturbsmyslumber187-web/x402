/**
 * X402 MCP Server Tools
 * 
 * Re-exports all tool definitions for backward compatibility.
 * New code should import from './tools/index.js' directly.
 */

import { ALL_TOOLS, TOTAL_TOOLS, ALL_CATEGORIES } from './tools/index.js';
import { TOOL_HANDLERS, createToolContext, type ToolContext, type ToolResult } from './handlers/index.js';

/**
 * X402 Tool Handler class (backward compatible)
 */
export class X402ToolHandler {
  private context: ToolContext;

  constructor(config?: { privateKey?: `0x${string}` }) {
    if (config?.privateKey) {
      process.env['WALLET_PRIVATE_KEY'] = config.privateKey;
    }
    this.context = createToolContext();
  }

  /**
   * Handle a tool call
   */
  async handleTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    return handler(args, this.context);
  }

  /**
   * Get all available tools
   */
  getTools() {
    return ALL_TOOLS;
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return TOTAL_TOOLS;
  }
}

/**
 * Legacy export
 */
export const X402_TOOLS = ALL_TOOLS;

export { ALL_TOOLS, TOTAL_TOOLS, ALL_CATEGORIES };
