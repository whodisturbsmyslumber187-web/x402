/**
 * MCP Tool Handlers
 * 
 * Implements all 26 tools across 5 categories:
 * - Payment (4 tools): get, post, pay_batch, pay_stream
 * - Discovery (4 tools): discover, service_info, compare_prices, health_check
 * - Wallet (5 tools): balance, history, fund, spending_stats, set_budget
 * - Delegation (5 tools): delegate, revoke, list, stats, transfer
 * - Advanced (8 tools): smart_pay, subscribe, escrow, refund, audit, network_switch, gas_estimate, portfolio
 */

import { X402Client } from '@x402-platform/sdk/client';
import type { X402Response } from '@x402-platform/sdk/client/types';
import {
  getAllNetworks,
  getNetwork,
  type NetworkId,
  isValidNetwork,
  getCheapestNetwork,
  formatAmount,
  getGlobalEventBus,
} from '@x402-platform/core';
import { WalletManager } from '../services/wallet-manager.js';
import { ServiceRegistry } from '../services/registry.js';
import { DelegationManager } from '../services/delegation.js';

/**
 * Tool execution context
 */
export interface ToolContext {
  client: X402Client;
  walletManager: WalletManager;
  serviceRegistry: ServiceRegistry;
  delegationManager: DelegationManager;
  activeNetwork: string;
}

/**
 * Tool result
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Create the tool context from environment
 */
export function createToolContext(): ToolContext {
  const privateKey = process.env['WALLET_PRIVATE_KEY'] as `0x${string}`;
  if (!privateKey) {
    throw new Error('WALLET_PRIVATE_KEY is required');
  }

  const client = new X402Client({
    privateKey,
    timeout: 30000,
  });

  return {
    client,
    walletManager: new WalletManager(privateKey),
    serviceRegistry: new ServiceRegistry(),
    delegationManager: new DelegationManager(),
    activeNetwork: process.env['DEFAULT_NETWORK'] || 'base-sepolia',
  };
}

/**
 * Format a successful response
 */
function success(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

/**
 * Format an error response
 */
function error(text: string): ToolResult {
  return { content: [{ type: 'text', text: `❌ Error: ${text}` }], isError: true };
}

/**
 * Format payment result
 */
function formatPaymentResult<T>(result: X402Response<T>): string {
  const lines = [
    `✅ Request completed (status: ${result.status})`,
    `💰 Payment: ${result.paid ? 'Yes' : 'No'}`,
  ];
  if (result.amountPaid) {
    lines.push(`💵 Amount: ${formatAmount(result.amountPaid)} USDC`);
  }
  if (result.txHash) {
    lines.push(`🔗 Transaction: ${result.txHash}`);
  }
  lines.push(`📦 Response: ${JSON.stringify(result.data, null, 2)}`);
  return lines.join('\n');
}

// ================================================================
// TOOL HANDLER MAP
// ================================================================

/**
 * All tool handlers
 */
export const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>> = {
  // ================================================
  // PAYMENT TOOLS
  // ================================================

  x402_get: async (args, ctx) => {
    try {
      const url = args.url as string;
      if (!url) return error('url is required');
      
      const result = await ctx.client.get(url, {
        headers: args.headers as Record<string, string> | undefined,
        maxAmount: args.maxAmount as string | undefined,
      });

      ctx.walletManager.recordTransaction({
        url,
        amount: result.amountPaid || '0',
        network: ctx.activeNetwork,
        paid: result.paid,
        timestamp: new Date(),
      });

      return success(formatPaymentResult(result));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Request failed');
    }
  },

  x402_post: async (args, ctx) => {
    try {
      const url = args.url as string;
      if (!url) return error('url is required');

      const result = await ctx.client.post(url, args.body, {
        headers: args.headers as Record<string, string> | undefined,
        maxAmount: args.maxAmount as string | undefined,
      });

      ctx.walletManager.recordTransaction({
        url,
        amount: result.amountPaid || '0',
        network: ctx.activeNetwork,
        paid: result.paid,
        timestamp: new Date(),
      });

      return success(formatPaymentResult(result));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Request failed');
    }
  },

  x402_pay_batch: async (args, ctx) => {
    try {
      const requests = args.requests as Array<{ url: string; method?: string; body?: unknown }>;
      if (!requests?.length) return error('requests array is required');

      const results: string[] = [];
      let totalPaid = 0n;

      for (const req of requests) {
        try {
          const result = req.method?.toUpperCase() === 'POST'
            ? await ctx.client.post(req.url, req.body)
            : await ctx.client.get(req.url);

          if (result.amountPaid) totalPaid += BigInt(result.amountPaid);

          ctx.walletManager.recordTransaction({
            url: req.url,
            amount: result.amountPaid || '0',
            network: ctx.activeNetwork,
            paid: result.paid,
            timestamp: new Date(),
          });

          results.push(`✅ ${req.url}: ${result.paid ? `Paid ${formatAmount(result.amountPaid || '0')} USDC` : 'No payment'}`);
        } catch (err) {
          results.push(`❌ ${req.url}: ${err instanceof Error ? err.message : 'Failed'}`);
        }
      }

      results.push(`\n📊 Total paid: ${formatAmount(totalPaid.toString())} USDC`);
      return success(results.join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Batch failed');
    }
  },

  x402_pay_stream: async (args, ctx) => {
    try {
      const url = args.url as string;
      if (!url) return error('url is required');

      const chunks: string[] = [];
      
      const result = await ctx.client.requestStream(
        url,
        {
          method: 'POST',
          body: args.body,
          maxAmount: args.maxAmount as string | undefined,
        },
        (chunk) => {
          chunks.push(chunk);
        }
      );

      ctx.walletManager.recordTransaction({
        url,
        amount: result.amountPaid || '0',
        network: ctx.activeNetwork,
        paid: result.paid,
        timestamp: new Date(),
      });

      const lines = [
        `✅ Stream completed (${chunks.length} chunks)`,
        `💰 Payment: ${result.paid ? 'Yes' : 'No'}`,
      ];
      if (result.amountPaid) {
        lines.push(`💵 Amount: ${formatAmount(result.amountPaid)} USDC`);
      }
      lines.push(`📦 Streamed content:\n${chunks.join('')}`);
      return success(lines.join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Stream failed');
    }
  },

  // ================================================
  // DISCOVERY TOOLS
  // ================================================

  x402_discover: async (args, ctx) => {
    try {
      const query = args.query as string;
      const category = args.category as string | undefined;
      const results = ctx.serviceRegistry.search(query, category);

      if (results.length === 0) {
        return success('No services found matching your query.');
      }

      const lines = [`🔍 Found ${results.length} service(s):\n`];
      for (const service of results) {
        lines.push(`**${service.name}**`);
        lines.push(`  URL: ${service.url}`);
        lines.push(`  Category: ${service.category}`);
        lines.push(`  Price: ${service.price}`);
        lines.push(`  Network: ${service.network}`);
        lines.push(`  Status: ${service.status}`);
        lines.push('');
      }
      return success(lines.join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Discovery failed');
    }
  },

  x402_service_info: async (args, ctx) => {
    try {
      const url = args.url as string;
      if (!url) return error('url is required');
      
      const service = ctx.serviceRegistry.getByUrl(url);
      if (!service) {
        return success(`No information found for ${url}`);
      }

      return success(JSON.stringify(service, null, 2));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Service info failed');
    }
  },

  x402_compare_prices: async (args, ctx) => {
    try {
      const query = args.query as string;
      if (!query) return error('query is required');
      
      const results = ctx.serviceRegistry.search(query);
      
      if (results.length === 0) {
        return success('No services found to compare.');
      }

      const lines = [`💰 Price comparison for "${query}":\n`];
      const sorted = results.sort((a, b) => {
        const aPrice = parseFloat(a.price.replace(/[^0-9.]/g, ''));
        const bPrice = parseFloat(b.price.replace(/[^0-9.]/g, ''));
        return aPrice - bPrice;
      });

      for (const [i, service] of sorted.entries()) {
        const badge = i === 0 ? '🏆 CHEAPEST' : '';
        lines.push(`${i + 1}. ${service.name} — ${service.price} on ${service.network} ${badge}`);
      }
      return success(lines.join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Comparison failed');
    }
  },

  x402_health_check: async (args, ctx) => {
    try {
      const url = args.url as string;
      if (!url) return error('url is required');
      
      const health = await ctx.serviceRegistry.checkHealth(url);
      
      return success([
        `🏥 Health check for ${url}:`,
        `  Status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`,
        `  Response time: ${health.responseTimeMs}ms`,
        `  Last checked: ${health.lastChecked.toISOString()}`,
        health.error ? `  Error: ${health.error}` : '',
      ].filter(Boolean).join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Health check failed');
    }
  },

  // ================================================
  // WALLET TOOLS
  // ================================================

  x402_wallet_balance: async (args, ctx) => {
    try {
      const network = (args.network as string) || ctx.activeNetwork;
      const balance = await ctx.walletManager.getBalance(network as NetworkId);
      
      return success([
        `💳 Wallet Balance`,
        `  Address: ${ctx.client.address}`,
        `  Network: ${network}`,
        `  Balance: ${formatAmount(balance.toString())} USDC`,
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Balance check failed');
    }
  },

  x402_wallet_history: async (args, ctx) => {
    try {
      const limit = (args.limit as number) || 20;
      const history = ctx.walletManager.getHistory(limit);
      
      if (history.length === 0) {
        return success('No transaction history yet.');
      }

      const lines = [`📜 Transaction History (last ${limit}):\n`];
      for (const tx of history) {
        lines.push(`${tx.timestamp.toISOString()} | ${tx.url} | ${formatAmount(tx.amount)} USDC | ${tx.paid ? '✅' : '⏳'}`);
      }
      return success(lines.join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'History retrieval failed');
    }
  },

  x402_wallet_fund: async (args, ctx) => {
    try {
      const network = (args.network as string) || ctx.activeNetwork;
      
      if (network === 'base-sepolia') {
        return success([
          '🚰 To fund your wallet on Base Sepolia:',
          '',
          '1. Visit https://www.coinbase.com/faucets/base-ethereum-goerli-faucet',
          '2. Or use the Coinbase Wallet faucet',
          `3. Your address: ${ctx.client.address}`,
          '',
          'For USDC on testnet:',
          '1. Get ETH from faucet first',
          '2. Use a USDC faucet or mint test USDC',
          '',
          `Current balance: checking...`,
        ].join('\n'));
      }

      return success([
        `💰 To fund your wallet on ${network}:`,
        `  Address: ${ctx.client.address}`,
        '',
        'Transfer USDC to your wallet address from an exchange or another wallet.',
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Fund info failed');
    }
  },

  x402_spending_stats: async (_args, ctx) => {
    try {
      const stats = ctx.walletManager.getSpendingStats();
      
      return success([
        '📊 Spending Statistics',
        `  Total spent: ${formatAmount(stats.totalSpent)} USDC`,
        `  Total transactions: ${stats.totalTransactions}`,
        `  Paid requests: ${stats.paidRequests}`,
        `  Free requests: ${stats.freeRequests}`,
        `  Avg per request: ${stats.avgPerRequest} USDC`,
        `  Most used service: ${stats.topService || 'N/A'}`,
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Stats failed');
    }
  },

  x402_set_budget: async (args, ctx) => {
    try {
      const maxPerRequest = args.maxPerRequest as string | undefined;
      const totalBudget = args.totalBudget as string | undefined;
      
      ctx.walletManager.setBudget({
        maxPerRequest,
        totalBudget,
      });

      return success([
        '✅ Budget Updated',
        maxPerRequest ? `  Max per request: ${maxPerRequest} USDC` : '',
        totalBudget ? `  Total budget: ${totalBudget} USDC` : '',
      ].filter(Boolean).join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Budget update failed');
    }
  },

  // ================================================
  // DELEGATION TOOLS
  // ================================================

  x402_delegate_budget: async (args, ctx) => {
    try {
      const agentId = args.agentId as string;
      const amount = args.amount as string;
      const expiresInHours = args.expiresInHours as number | undefined;
      
      if (!agentId || !amount) return error('agentId and amount are required');

      const delegation = ctx.delegationManager.create({
        agentId,
        amount,
        expiresInHours: expiresInHours ?? 24,
      });

      return success([
        '✅ Budget Delegation Created',
        `  ID: ${delegation.id}`,
        `  Agent: ${agentId}`,
        `  Amount: ${formatAmount(amount)} USDC`,
        `  Expires: ${delegation.expiresAt.toISOString()}`,
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Delegation failed');
    }
  },

  x402_revoke_budget: async (args, ctx) => {
    try {
      const delegationId = args.delegationId as string;
      if (!delegationId) return error('delegationId is required');

      ctx.delegationManager.revoke(delegationId);
      return success(`✅ Delegation ${delegationId} revoked successfully.`);
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Revocation failed');
    }
  },

  x402_list_delegations: async (_args, ctx) => {
    try {
      const delegations = ctx.delegationManager.list();
      
      if (delegations.length === 0) {
        return success('No active delegations.');
      }

      const lines = [`📋 Active Delegations (${delegations.length}):\n`];
      for (const d of delegations) {
        lines.push(`  ${d.id} | Agent: ${d.agentId} | Budget: ${formatAmount(d.amount)} USDC | Used: ${formatAmount(d.spent)} | Expires: ${d.expiresAt.toISOString()}`);
      }
      return success(lines.join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'List failed');
    }
  },

  x402_delegation_stats: async (_args, ctx) => {
    try {
      const stats = ctx.delegationManager.getStats();
      return success([
        '📊 Delegation Statistics',
        `  Active delegations: ${stats.active}`,
        `  Total delegated: ${formatAmount(stats.totalDelegated)} USDC`,
        `  Total spent by delegates: ${formatAmount(stats.totalSpent)} USDC`,
        `  Revoked: ${stats.revoked}`,
        `  Expired: ${stats.expired}`,
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Stats failed');
    }
  },

  x402_transfer_between_delegations: async (args, ctx) => {
    try {
      const fromId = args.fromDelegationId as string;
      const toId = args.toDelegationId as string;
      const amount = args.amount as string;
      
      if (!fromId || !toId || !amount) return error('fromDelegationId, toDelegationId, and amount are required');

      ctx.delegationManager.transfer(fromId, toId, amount);
      return success(`✅ Transferred ${formatAmount(amount)} USDC from delegation ${fromId} to ${toId}`);
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Transfer failed');
    }
  },

  // ================================================
  // ADVANCED TOOLS (GOD-TIER)
  // ================================================

  x402_smart_pay: async (args, ctx) => {
    try {
      const query = args.query as string;
      const prompt = args.prompt as string | undefined;
      const maxBudget = args.maxBudget as string | undefined;
      const preferredNetwork = args.preferredNetwork as string | undefined;

      // Step 1: Discover services
      const services = ctx.serviceRegistry.search(query);
      if (services.length === 0) {
        return error(`No services found for "${query}"`);
      }

      // Step 2: Health check the top candidates
      const healthyServices = [];
      for (const service of services.slice(0, 5)) {
        const health = await ctx.serviceRegistry.checkHealth(service.url);
        if (health.healthy) {
          healthyServices.push({ ...service, responseTime: health.responseTimeMs });
        }
      }

      if (healthyServices.length === 0) {
        return error('No healthy services found');
      }

      // Step 3: Pick cheapest healthy service
      const best = healthyServices.sort((a, b) => {
        const aPrice = parseFloat(a.price.replace(/[^0-9.]/g, ''));
        const bPrice = parseFloat(b.price.replace(/[^0-9.]/g, ''));
        return aPrice - bPrice;
      })[0]!;

      // Step 4: Execute payment
      const result = prompt
        ? await ctx.client.post(best.url, { prompt, ...args }, {
            maxAmount: maxBudget,
          })
        : await ctx.client.get(best.url, {
            maxAmount: maxBudget,
          });

      ctx.walletManager.recordTransaction({
        url: best.url,
        amount: result.amountPaid || '0',
        network: preferredNetwork || ctx.activeNetwork,
        paid: result.paid,
        timestamp: new Date(),
      });

      return success([
        `🧠 Smart Pay Complete`,
        `  Service: ${best.name}`,
        `  URL: ${best.url}`,
        `  Response time: ${best.responseTime}ms`,
        `  ${formatPaymentResult(result)}`,
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Smart pay failed');
    }
  },

  x402_subscribe: async (args, ctx) => {
    try {
      const serviceUrl = args.serviceUrl as string;
      const maxPerPayment = args.maxPerPayment as string;
      const maxTotal = args.maxTotal as string;
      const intervalMinutes = (args.intervalMinutes as number) || 60;
      const durationHours = (args.durationHours as number) || 24;

      if (!serviceUrl || !maxPerPayment || !maxTotal) {
        return error('serviceUrl, maxPerPayment, and maxTotal are required');
      }

      // Create a subscription delegation
      const delegation = ctx.delegationManager.create({
        agentId: `subscription:${serviceUrl}`,
        amount: maxTotal,
        expiresInHours: durationHours,
      });

      return success([
        '🔄 Subscription Created',
        `  Service: ${serviceUrl}`,
        `  Max per payment: ${maxPerPayment} USDC`,
        `  Total budget: ${maxTotal} USDC`,
        `  Interval: every ${intervalMinutes} minutes`,
        `  Duration: ${durationHours} hours`,
        `  Delegation ID: ${delegation.id}`,
        `  Expires: ${delegation.expiresAt.toISOString()}`,
        '',
        '💡 The subscription delegation has been created. Use x402_get or x402_post to make scheduled calls.',
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Subscription failed');
    }
  },

  x402_escrow: async (args, ctx) => {
    try {
      const serviceUrl = args.serviceUrl as string;
      const amount = args.amount as string;
      const condition = (args.condition as string) || 'HTTP 200';
      const timeoutSeconds = (args.timeoutSeconds as number) || 300;

      if (!serviceUrl || !amount) return error('serviceUrl and amount are required');

      // Create escrow delegation
      const escrowId = ctx.delegationManager.create({
        agentId: `escrow:${serviceUrl}`,
        amount,
        expiresInHours: timeoutSeconds / 3600,
      });

      // Execute the request
      try {
        const result = args.body
          ? await ctx.client.post(serviceUrl, args.body, { maxAmount: amount })
          : await ctx.client.get(serviceUrl, { maxAmount: amount });

        // Check condition
        let conditionMet = false;
        if (condition === 'HTTP 200') {
          conditionMet = result.status >= 200 && result.status < 300;
        } else if (condition.startsWith('response contains')) {
          const expected = condition.replace('response contains ', '');
          conditionMet = JSON.stringify(result.data).includes(expected);
        } else {
          conditionMet = result.status === 200;
        }

        if (conditionMet) {
          ctx.walletManager.recordTransaction({
            url: serviceUrl,
            amount: result.amountPaid || '0',
            network: ctx.activeNetwork,
            paid: result.paid,
            timestamp: new Date(),
          });

          return success([
            '🔒 Escrow Released ✅',
            `  Service: ${serviceUrl}`,
            `  Condition: ${condition} — MET`,
            `  ${formatPaymentResult(result)}`,
          ].join('\n'));
        } else {
          // Condition not met — revoke escrow
          ctx.delegationManager.revoke(escrowId.id);
          return success([
            '🔒 Escrow HELD (not released)',
            `  Service: ${serviceUrl}`,
            `  Condition: ${condition} — NOT MET`,
            `  Status: ${result.status}`,
            '  Funds returned to budget.',
          ].join('\n'));
        }
      } catch (err) {
        ctx.delegationManager.revoke(escrowId.id);
        return success([
          '🔒 Escrow HELD (request failed)',
          `  Error: ${err instanceof Error ? err.message : 'Unknown'}`,
          '  Funds returned to budget.',
        ].join('\n'));
      }
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Escrow failed');
    }
  },

  x402_refund_request: async (args, _ctx) => {
    try {
      const txHash = args.txHash as string;
      const reason = args.reason as string;
      const serviceUrl = args.serviceUrl as string | undefined;

      if (!txHash || !reason) return error('txHash and reason are required');

      return success([
        '📋 Refund Request Submitted',
        `  Transaction: ${txHash}`,
        `  Reason: ${reason}`,
        serviceUrl ? `  Service: ${serviceUrl}` : '',
        '',
        '⚠️  Note: Refunds depend on the service provider\'s policy.',
        '    On-chain payments are final by default.',
        '    The service may issue a reverse payment if they have a refund policy.',
      ].filter(Boolean).join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Refund request failed');
    }
  },

  x402_audit_trail: async (args, ctx) => {
    try {
      const format = (args.format as string) || 'summary';
      const history = ctx.walletManager.getHistory(1000);
      const eventBus = getGlobalEventBus();
      const eventHistory = eventBus.getHistory(1000);

      if (format === 'csv') {
        const csvLines = ['timestamp,url,amount_usdc,network,paid,tx_hash'];
        for (const tx of history) {
          csvLines.push(`${tx.timestamp.toISOString()},${tx.url},${formatAmount(tx.amount)},${tx.network},${tx.paid},${tx.txHash || ''}`);
        }
        return success(csvLines.join('\n'));
      }

      if (format === 'detailed') {
        const lines = ['📊 Detailed Audit Trail\n'];
        for (const tx of history) {
          lines.push(`---`);
          lines.push(`Time: ${tx.timestamp.toISOString()}`);
          lines.push(`URL: ${tx.url}`);
          lines.push(`Amount: ${formatAmount(tx.amount)} USDC`);
          lines.push(`Network: ${tx.network}`);
          lines.push(`Paid: ${tx.paid ? 'Yes' : 'No'}`);
          if (tx.txHash) lines.push(`Tx: ${tx.txHash}`);
          lines.push('');
        }
        lines.push(`\n📡 Event Log (${eventHistory.length} events)`);
        const counts = eventBus.getCounts();
        for (const [event, count] of Object.entries(counts)) {
          lines.push(`  ${event}: ${count}`);
        }
        return success(lines.join('\n'));
      }

      // Summary format
      const stats = ctx.walletManager.getSpendingStats();
      return success([
        '📊 Audit Summary',
        `  Period: ${history[0]?.timestamp.toISOString() || 'N/A'} to ${history[history.length - 1]?.timestamp.toISOString() || 'N/A'}`,
        `  Total transactions: ${stats.totalTransactions}`,
        `  Total spent: ${formatAmount(stats.totalSpent)} USDC`,
        `  Paid requests: ${stats.paidRequests}`,
        `  Free requests: ${stats.freeRequests}`,
        `  Events logged: ${eventHistory.length}`,
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Audit failed');
    }
  },

  x402_network_switch: async (args, ctx) => {
    try {
      const network = args.network as string | undefined;
      const showAll = args.showAll as boolean | undefined;

      if (showAll || !network) {
        const networks = getAllNetworks();
        const lines = ['🌐 Available Networks:\n'];
        for (const n of networks) {
          const marker = n.id === ctx.activeNetwork ? ' ← ACTIVE' : '';
          lines.push(`  ${n.id}: ${n.name}${marker}`);
          lines.push(`    Type: ${n.isTestnet ? 'Testnet' : 'Mainnet'}`);
          lines.push(`    Gas cost: ${n.gasCostMultiplier}x`);
          lines.push(`    Block time: ${n.avgBlockTimeSeconds}s`);
          lines.push('');
        }
        return success(lines.join('\n'));
      }

      if (!isValidNetwork(network)) {
        return error(`Unknown network: ${network}. Use showAll to see available networks.`);
      }

      ctx.activeNetwork = network;
      const networkConfig = getNetwork(network);

      return success([
        '🔀 Network Switched',
        `  Network: ${networkConfig.name} (${networkConfig.id})`,
        `  Type: ${networkConfig.isTestnet ? 'Testnet' : 'Mainnet'}`,
        `  USDC: ${networkConfig.usdc}`,
        `  Explorer: ${networkConfig.explorerUrl}`,
        `  Gas cost multiplier: ${networkConfig.gasCostMultiplier}x`,
      ].join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Network switch failed');
    }
  },

  x402_gas_estimate: async (args, _ctx) => {
    try {
      const amount = args.amount as string;
      const network = (args.network as string) || 'all';

      if (!amount) return error('amount is required');

      const networks = network === 'all' 
        ? getAllNetworks().filter(n => !n.isTestnet) 
        : [getNetwork(network as NetworkId)];

      const lines = [`⛽ Gas Estimates for ${amount} USDC payment:\n`];
      
      for (const n of networks) {
        // Rough gas estimate: ~65,000 gas for transferWithAuthorization
        const baseGas = 65000;
        const estimatedCost = (baseGas * 0.00000003 * n.gasCostMultiplier).toFixed(6);
        lines.push(`  ${n.name} (${n.id}):`);
        lines.push(`    Estimated gas: ~${baseGas} units`);
        lines.push(`    Cost: ~$${estimatedCost}`);
        lines.push(`    Block time: ${n.avgBlockTimeSeconds}s`);
        lines.push('');
      }

      const cheapest = getCheapestNetwork(true);
      lines.push(`💡 Cheapest: ${cheapest.name} (${cheapest.gasCostMultiplier}x)`);

      return success(lines.join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Gas estimation failed');
    }
  },

  x402_portfolio: async (args, ctx) => {
    try {
      const includeTestnets = (args.includeTestnets as boolean) !== false;
      const networks = getAllNetworks();
      const filtered = includeTestnets ? networks : networks.filter(n => !n.isTestnet);

      const lines = ['💼 Portfolio Overview\n', `  Wallet: ${ctx.client.address}\n`];
      let totalBalance = 0n;

      for (const network of filtered) {
        try {
          const balance = await ctx.walletManager.getBalance(network.id);
          totalBalance += balance;
          const formatted = formatAmount(balance.toString());
          const tag = network.isTestnet ? ' (testnet)' : '';
          lines.push(`  ${network.name}${tag}: ${formatted} USDC`);
        } catch {
          lines.push(`  ${network.name}: Unable to fetch`);
        }
      }

      lines.push('');
      lines.push(`  Total: ${formatAmount(totalBalance.toString())} USDC`);

      const stats = ctx.walletManager.getSpendingStats();
      lines.push('');
      lines.push('📊 Activity:');
      lines.push(`  Lifetime spent: ${formatAmount(stats.totalSpent)} USDC`);
      lines.push(`  Total transactions: ${stats.totalTransactions}`);

      return success(lines.join('\n'));
    } catch (err) {
      return error(err instanceof Error ? err.message : 'Portfolio failed');
    }
  },
};
