/**
 * Facilitator Server
 * 
 * Entry point for the x402 facilitator service.
 * Handles payment verification and on-chain settlement.
 */

import { serve } from '@hono/node-server';
import { loadConfig } from './config.js';
import { createRoutes } from './routes.js';
import { PaymentVerifier } from './verifier.js';
import { PaymentSettler } from './settler.js';

/**
 * Start the facilitator server
 */
async function main() {
  const config = loadConfig();

  // Create verifier and settler
  const verifier = new PaymentVerifier(config.rpcUrls);
  const settler = new PaymentSettler(config.privateKey, config.rpcUrls, config.feeBps);

  // Create routes
  const app = createRoutes(verifier, settler, {
    rateLimitEnabled: config.rateLimitEnabled,
    rateLimit: config.rateLimit,
  });

  // Start server
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              X402 Facilitator v3.0.0                        ║
╠══════════════════════════════════════════════════════════════╣
║  Port:          ${String(config.port).padEnd(42)}║
║  Facilitator:   ${settler.address.slice(0, 12)}...${settler.address.slice(-8).padEnd(24)}║
║  Metrics:       ${(config.metricsEnabled ? 'Enabled' : 'Disabled').padEnd(42)}║
║  Rate Limit:    ${(config.rateLimitEnabled ? `${config.rateLimit} req/s` : 'Disabled').padEnd(42)}║
║  Fee:           ${(`${config.feeBps} bps`).padEnd(42)}║
║  Networks:      ${Object.keys(config.rpcUrls).length > 0 ? Object.keys(config.rpcUrls).join(', ').slice(0, 42).padEnd(42) : 'All defaults'.padEnd(42)}║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                 ║
║    GET  /health        Health check                         ║
║    GET  /status        Detailed status + metrics            ║
║    GET  /metrics       Prometheus-compatible metrics         ║
║    GET  /supported     Supported schemes & networks          ║
║    POST /verify        Verify payment                        ║
║    POST /settle        Settle payment on-chain               ║
║    POST /estimate-gas  Estimate settlement gas               ║
║    GET  /revenue       Revenue summary + provider balances   ║
║    GET  /payouts/preview  Preview net payouts                ║
╚══════════════════════════════════════════════════════════════╝
  `);

  serve({
    fetch: app.fetch,
    port: config.port,
  });

  console.log(`🚀 Facilitator listening on http://localhost:${config.port}`);
}

main().catch((error) => {
  console.error('❌ Failed to start facilitator:', error);
  process.exit(1);
});
