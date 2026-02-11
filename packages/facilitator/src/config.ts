/**
 * Facilitator Configuration
 * 
 * Loads configuration from environment variables.
 * Supports multi-chain deployment.
 */

import { getSupportedNetworks } from '@x402-platform/core';

/**
 * Facilitator Configuration
 */
export interface FacilitatorConfig {
  /** Port to listen on */
  port: number;

  /** Facilitator private key for settlement transactions */
  privateKey: `0x${string}`;

  /** RPC URLs per network */
  rpcUrls: Record<string, string>;

  /** Rate limiting: requests per second (default: 50) */
  rateLimit: number;

  /** Whether to enable metrics endpoint */
  metricsEnabled: boolean;

  /** Whether to enable rate limiting */
  rateLimitEnabled: boolean;

  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  /** Platform fee in basis points applied for revenue accounting */
  feeBps: number;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): FacilitatorConfig {
  const privateKey = process.env['FACILITATOR_PRIVATE_KEY'] as `0x${string}`;
  
  if (!privateKey) {
    throw new Error('FACILITATOR_PRIVATE_KEY environment variable is required');
  }

  // Build RPC URLs map from environment
  const rpcUrls: Record<string, string> = {};
  const networks = getSupportedNetworks();

  for (const network of networks) {
    const envKey = `RPC_URL_${network.toUpperCase().replace(/-/g, '_')}`;
    const url = process.env[envKey];
    if (url) {
      rpcUrls[network] = url;
    }
  }

  // Legacy support: BASE_RPC_URL
  if (process.env['BASE_RPC_URL']) {
    rpcUrls['base-mainnet'] = process.env['BASE_RPC_URL'];
  }
  if (process.env['BASE_SEPOLIA_RPC_URL']) {
    rpcUrls['base-sepolia'] = process.env['BASE_SEPOLIA_RPC_URL'];
  }

  return {
    port: parseInt(process.env['PORT'] || '4020', 10),
    privateKey,
    rpcUrls,
    rateLimit: parseInt(process.env['RATE_LIMIT'] || '50', 10),
    metricsEnabled: process.env['METRICS_ENABLED'] !== 'false',
    rateLimitEnabled: process.env['RATE_LIMIT_ENABLED'] !== 'false',
    logLevel: (process.env['LOG_LEVEL'] || 'info') as FacilitatorConfig['logLevel'],
    feeBps: parseInt(process.env['FEE_BPS'] || '50', 10),
  };
}
