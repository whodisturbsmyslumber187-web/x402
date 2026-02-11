/**
 * Facilitator Routes
 * 
 * HTTP routes for the facilitator service.
 * Provides endpoints for verification, settlement, health, metrics, and status.
 */

import { Hono } from 'hono';
import { PaymentVerifier } from './verifier.js';
import { PaymentSettler } from './settler.js';
import {
  verifyRequestSchema,
  settleRequestSchema,
  type PaymentRequirements,
  SCHEMES,
  getSupportedNetworks,
  RateLimiter,
} from '@x402-platform/core';

/**
 * Create the facilitator Hono app with all routes
 */
export function createRoutes(
  verifier: PaymentVerifier,
  settler: PaymentSettler,
  options?: {
    /** Enable rate limiting (default: true) */
    rateLimitEnabled?: boolean;
    /** Requests per second (default: 50) */
    rateLimit?: number;
  }
): Hono {
  const app = new Hono();
  const startTime = Date.now();

  // Rate limiter
  const rateLimiter = new RateLimiter({
    maxTokens: options?.rateLimit ?? 50,
    refillRatePerSecond: options?.rateLimit ?? 50,
  });

  // Rate limiting middleware
  if (options?.rateLimitEnabled !== false) {
    app.use('*', async (c, next) => {
      if (!rateLimiter.tryConsume()) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
      await next();
    });
  }

  // Request ID middleware
  app.use('*', async (c, next) => {
    const requestId = crypto.randomUUID();
    c.header('X-Request-ID', requestId);
    await next();
  });

  // ================================================
  // Health Check
  // ================================================
  app.get('/health', (c) => {
    return c.json({
      status: 'healthy',
      version: '3.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      facilitator: settler.address,
    });
  });

  // ================================================
  // Detailed Status
  // ================================================
  app.get('/status', (c) => {
    const verifierMetrics = verifier.getMetrics();
    const settlerMetrics = settler.getMetrics();

    return c.json({
      status: 'operational',
      version: '3.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      facilitator: settler.address,
      verifier: {
        total: verifierMetrics.totalVerifications,
        successful: verifierMetrics.successfulVerifications,
        failed: verifierMetrics.failedVerifications,
        avgLatencyMs: Math.round(verifierMetrics.averageLatencyMs * 100) / 100,
        nonceCacheSize: verifierMetrics.nonceCacheSize,
        replayAttemptsBlocked: verifierMetrics.replayAttemptsBlocked,
      },
      settler: {
        total: settlerMetrics.totalSettlements,
        successful: settlerMetrics.successfulSettlements,
        failed: settlerMetrics.failedSettlements,
        avgLatencyMs: Math.round(settlerMetrics.averageLatencyMs * 100) / 100,
        totalGasUsed: settlerMetrics.totalGasUsed.toString(),
      },
      revenue: settler.getRevenueSummary(),
      rateLimit: {
        available: rateLimiter.getAvailableTokens(),
      },
    });
  });

  // ================================================
  // Prometheus-compatible Metrics
  // ================================================
  app.get('/metrics', (c) => {
    const vm = verifier.getMetrics();
    const sm = settler.getMetrics();
    const rs = settler.getRevenueSummary();
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    const lines = [
      '# HELP x402_uptime_seconds Facilitator uptime in seconds',
      '# TYPE x402_uptime_seconds gauge',
      `x402_uptime_seconds ${uptimeSeconds}`,
      '',
      '# HELP x402_verifications_total Total payment verifications',
      '# TYPE x402_verifications_total counter',
      `x402_verifications_total{result="success"} ${vm.successfulVerifications}`,
      `x402_verifications_total{result="failure"} ${vm.failedVerifications}`,
      '',
      '# HELP x402_verification_latency_ms Average verification latency',
      '# TYPE x402_verification_latency_ms gauge',
      `x402_verification_latency_ms ${vm.averageLatencyMs.toFixed(2)}`,
      '',
      '# HELP x402_settlements_total Total payment settlements',
      '# TYPE x402_settlements_total counter',
      `x402_settlements_total{result="success"} ${sm.successfulSettlements}`,
      `x402_settlements_total{result="failure"} ${sm.failedSettlements}`,
      '',
      '# HELP x402_settlement_latency_ms Average settlement latency',
      '# TYPE x402_settlement_latency_ms gauge',
      `x402_settlement_latency_ms ${sm.averageLatencyMs.toFixed(2)}`,
      '',
      '# HELP x402_gas_used_total Total gas used for settlements',
      '# TYPE x402_gas_used_total counter',
      `x402_gas_used_total ${sm.totalGasUsed.toString()}`,
      '',
      '# HELP x402_nonce_cache_size Current nonce cache size',
      '# TYPE x402_nonce_cache_size gauge',
      `x402_nonce_cache_size ${vm.nonceCacheSize}`,
      '',
      '# HELP x402_replay_attacks_blocked Total replay attempts blocked',
      '# TYPE x402_replay_attacks_blocked counter',
      `x402_replay_attacks_blocked ${vm.replayAttemptsBlocked}`,
      '',
      '# HELP x402_fee_bps Configured platform fee in basis points',
      '# TYPE x402_fee_bps gauge',
      `x402_fee_bps ${rs.feeBps}`,
      '',
      '# HELP x402_revenue_gross_total Gross amount settled across providers',
      '# TYPE x402_revenue_gross_total counter',
      `x402_revenue_gross_total ${rs.totalGrossAmount}`,
      '',
      '# HELP x402_revenue_fee_total Total estimated platform fees',
      '# TYPE x402_revenue_fee_total counter',
      `x402_revenue_fee_total ${rs.totalFeeAmount}`,
    ];

    c.header('Content-Type', 'text/plain; version=0.0.4');
    return c.text(lines.join('\n'));
  });

  // ================================================
  // Supported Schemes & Networks
  // ================================================
  app.get('/supported', (c) => {
    const networks = getSupportedNetworks();
    const kinds = networks.flatMap((network: string) => [
      { scheme: SCHEMES.EXACT, network },
      { scheme: SCHEMES.UPTO, network },
    ]);
    return c.json({ kinds });
  });

  // ================================================
  // Verify Payment
  // ================================================
  app.post('/verify', async (c) => {
    try {
      const body = await c.req.json();
      const parsed = verifyRequestSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ 
          isValid: false, 
          invalidReason: `Invalid request: ${parsed.error.message}` 
        }, 400);
      }

      const result = await verifier.verify(
        parsed.data.paymentHeader,
        parsed.data.paymentRequirements as PaymentRequirements
      );

      return c.json({
        isValid: result.isValid,
        invalidReason: result.invalidReason,
      });
    } catch (error) {
      return c.json({
        isValid: false,
        invalidReason: error instanceof Error ? error.message : 'Internal error',
      }, 500);
    }
  });

  // ================================================
  // Settle Payment
  // ================================================
  app.post('/settle', async (c) => {
    try {
      const body = await c.req.json();
      const parsed = settleRequestSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({
          success: false,
          error: `Invalid request: ${parsed.error.message}`,
          txHash: null,
          networkId: null,
        }, 400);
      }

      const result = await settler.settle(
        parsed.data.paymentHeader,
        parsed.data.paymentRequirements as PaymentRequirements,
        {
          // For upto scheme, client can specify actual amount in body
          actualAmount: (body as Record<string, unknown>).actualAmount as string | undefined,
        }
      );

      return c.json({
        success: result.success,
        error: result.error,
        txHash: result.txHash,
        networkId: result.networkId,
        actualAmount: result.actualAmount,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
        txHash: null,
        networkId: null,
      }, 500);
    }
  });

  // ================================================
  // Gas Estimation
  // ================================================
  app.post('/estimate-gas', async (c) => {
    try {
      const body = await c.req.json();
      const parsed = settleRequestSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: `Invalid request: ${parsed.error.message}` }, 400);
      }

      const result = await settler.estimateGas(
        parsed.data.paymentHeader,
        parsed.data.paymentRequirements as PaymentRequirements
      );

      return c.json(result);
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : 'Gas estimation failed',
      }, 500);
    }
  });

  // ================================================
  // Revenue Summary
  // ================================================
  app.get('/revenue', (c) => {
    return c.json({
      ...settler.getRevenueSummary(),
      recent: settler.getRecentRevenue(100),
    });
  });

  // ================================================
  // Provider Payout Preview
  // ================================================
  app.get('/payouts/preview', (c) => {
    const summary = settler.getRevenueSummary();
    return c.json({
      feeBps: summary.feeBps,
      payouts: summary.providerBalances.map((provider) => ({
        provider: provider.provider,
        grossAmount: provider.grossAmount,
        feeAmount: provider.feeAmount,
        netAmount: provider.netAmount,
      })),
      generatedAt: new Date().toISOString(),
    });
  });

  return app;
}
