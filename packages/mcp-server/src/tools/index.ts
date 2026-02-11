/**
 * Tool Index
 * 
 * Central export for all MCP tool definitions.
 * Total: 26 tools across 5 categories.
 */

export { PAYMENT_TOOLS, PAYMENT_TOOL_CATEGORY } from './payment.js';
export { DISCOVERY_TOOLS, DISCOVERY_TOOL_CATEGORY } from './discovery.js';
export { WALLET_TOOLS, WALLET_TOOL_CATEGORY } from './wallet.js';
export { DELEGATION_TOOLS, DELEGATION_TOOL_CATEGORY } from './delegation.js';
export { ADVANCED_TOOLS, ADVANCED_TOOL_CATEGORY } from './advanced.js';

import { PAYMENT_TOOLS } from './payment.js';
import { DISCOVERY_TOOLS } from './discovery.js';
import { WALLET_TOOLS } from './wallet.js';
import { DELEGATION_TOOLS } from './delegation.js';
import { ADVANCED_TOOLS } from './advanced.js';

/**
 * All tool definitions combined
 */
export const ALL_TOOLS = {
  ...PAYMENT_TOOLS,
  ...DISCOVERY_TOOLS,
  ...WALLET_TOOLS,
  ...DELEGATION_TOOLS,
  ...ADVANCED_TOOLS,
} as const;

/**
 * All categories
 */
export const ALL_CATEGORIES = [
  { name: 'Payment', count: Object.keys(PAYMENT_TOOLS).length },
  { name: 'Discovery', count: Object.keys(DISCOVERY_TOOLS).length },
  { name: 'Wallet', count: Object.keys(WALLET_TOOLS).length },
  { name: 'Delegation', count: Object.keys(DELEGATION_TOOLS).length },
  { name: 'Advanced', count: Object.keys(ADVANCED_TOOLS).length },
];

/**
 * Total tool count
 */
export const TOTAL_TOOLS = Object.keys(ALL_TOOLS).length;
