/**
 * Network Types and Configurations
 * 
 * Supported blockchain networks and their configurations.
 * Multi-chain support: Base, Ethereum, Arbitrum, Optimism
 */

import type { Address, Chain } from 'viem';
import { base, baseSepolia, mainnet, arbitrum, optimism } from 'viem/chains';

/**
 * Supported network identifiers
 */
export type NetworkId = 
  | 'base-mainnet'
  | 'base-sepolia'
  | 'ethereum-mainnet'
  | 'arbitrum-one'
  | 'optimism-mainnet';

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Network identifier used in x402 */
  id: NetworkId;
  
  /** Human-readable name */
  name: string;
  
  /** Viem chain configuration */
  chain: Chain;
  
  /** USDC contract address on this network */
  usdc: Address;
  
  /** Whether this is a testnet */
  isTestnet: boolean;
  
  /** Default RPC URL */
  rpcUrl: string;
  
  /** Block explorer URL */
  explorerUrl: string;

  /** Average block time in seconds (for gas estimation) */
  avgBlockTimeSeconds: number;

  /** Typical gas cost multiplier relative to Base (1.0 = same as Base) */
  gasCostMultiplier: number;
}

/**
 * Supported networks configuration
 */
export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  'base-mainnet': {
    id: 'base-mainnet',
    name: 'Base',
    chain: base,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    isTestnet: false,
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    avgBlockTimeSeconds: 2,
    gasCostMultiplier: 1.0,
  },
  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    chain: baseSepolia,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
    isTestnet: true,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    avgBlockTimeSeconds: 2,
    gasCostMultiplier: 0.1,
  },
  'ethereum-mainnet': {
    id: 'ethereum-mainnet',
    name: 'Ethereum',
    chain: mainnet,
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    isTestnet: false,
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    avgBlockTimeSeconds: 12,
    gasCostMultiplier: 50.0,
  },
  'arbitrum-one': {
    id: 'arbitrum-one',
    name: 'Arbitrum One',
    chain: arbitrum,
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    isTestnet: false,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    avgBlockTimeSeconds: 0.25,
    gasCostMultiplier: 0.5,
  },
  'optimism-mainnet': {
    id: 'optimism-mainnet',
    name: 'Optimism',
    chain: optimism,
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' as Address,
    isTestnet: false,
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    avgBlockTimeSeconds: 2,
    gasCostMultiplier: 0.8,
  },
};

/**
 * Get network config by ID
 */
export function getNetwork(networkId: NetworkId): NetworkConfig {
  const network = NETWORKS[networkId];
  if (!network) {
    throw new Error(`Unknown network: ${networkId}`);
  }
  return network;
}

/**
 * Check if a network ID is valid
 */
export function isValidNetwork(networkId: string): networkId is NetworkId {
  return networkId in NETWORKS;
}

/**
 * Get all available networks
 */
export function getAllNetworks(): NetworkConfig[] {
  return Object.values(NETWORKS);
}

/**
 * Get only mainnet networks
 */
export function getMainnets(): NetworkConfig[] {
  return Object.values(NETWORKS).filter(n => !n.isTestnet);
}

/**
 * Get only testnet networks
 */
export function getTestnets(): NetworkConfig[] {
  return Object.values(NETWORKS).filter(n => n.isTestnet);
}

/**
 * Get all supported network IDs
 */
export function getSupportedNetworks(): NetworkId[] {
  return Object.keys(NETWORKS) as NetworkId[];
}

/**
 * Get the cheapest network for settlement (by gas cost)
 */
export function getCheapestNetwork(excludeTestnets = true): NetworkConfig {
  const networks = excludeTestnets ? getMainnets() : getAllNetworks();
  return networks.reduce((cheapest, n) => 
    n.gasCostMultiplier < cheapest.gasCostMultiplier ? n : cheapest
  );
}

/**
 * Supported assets (tokens)
 */
export type AssetSymbol = 'USDC';

/**
 * Asset configuration
 */
export interface AssetConfig {
  symbol: AssetSymbol;
  name: string;
  decimals: number;
}

/**
 * Supported assets
 */
export const ASSETS: Record<AssetSymbol, AssetConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
};
