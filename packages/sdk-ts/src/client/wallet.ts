/**
 * Wallet Management for x402 Payments
 * 
 * Handles EIP-3009 authorization signing for USDC transfers.
 * Supports both 'exact' and 'upto' schemes.
 * Includes nonce tracking to prevent self-conflicts.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import {
  type PaymentRequirements,
  type ExactSchemePayload,
  type UptoSchemePayload,
  getNetwork,
  type NetworkId,
  getAllNetworks,
} from '@x402-platform/core';

/**
 * X402 Wallet for signing payment authorizations
 * Supports exact and upto schemes, multi-network
 */
export class X402Wallet {
  private account: PrivateKeyAccount;
  private walletClients: Map<NetworkId, ReturnType<typeof createWalletClient>> = new Map();
  private publicClients: Map<NetworkId, ReturnType<typeof createPublicClient>> = new Map();
  private usedNonces: Set<string> = new Set();

  constructor(privateKey: `0x${string}`) {
    this.account = privateKeyToAccount(privateKey);
  }

  /**
   * Get wallet address
   */
  get address(): Address {
    return this.account.address;
  }

  /**
   * Get or create wallet client for a network
   */
  private getWalletClient(networkId: NetworkId) {
    let client = this.walletClients.get(networkId);
    if (!client) {
      const network = getNetwork(networkId);
      client = createWalletClient({
        account: this.account,
        chain: network.chain,
        transport: http(network.rpcUrl),
      });
      this.walletClients.set(networkId, client);
    }
    return client;
  }

  /**
   * Get or create public client for a network
   */
  private getPublicClient(networkId: NetworkId) {
    let client = this.publicClients.get(networkId);
    if (!client) {
      const network = getNetwork(networkId);
      client = createPublicClient({
        chain: network.chain,
        transport: http(network.rpcUrl),
      });
      this.publicClients.set(networkId, client);
    }
    return client;
  }

  /**
   * Generate a unique nonce (with self-conflict prevention)
   */
  private generateNonce(): Hex {
    let nonce: Hex;
    let attempts = 0;
    do {
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
      nonce = `0x${hex}` as Hex;
      attempts++;
    } while (this.usedNonces.has(nonce) && attempts < 100);
    
    this.usedNonces.add(nonce);
    
    // Garbage collect old nonces (keep last 10000)
    if (this.usedNonces.size > 10000) {
      const arr = [...this.usedNonces];
      this.usedNonces = new Set(arr.slice(-5000));
    }

    return nonce;
  }

  /**
   * Sign a payment authorization (exact scheme)
   */
  async signPaymentAuthorization(
    requirements: PaymentRequirements,
    options?: {
      /** Override amount (default: use maxAmountRequired) */
      amount?: string | bigint;
      /** Validity window in seconds (default: 300 = 5 minutes) */
      validityWindow?: number;
    }
  ): Promise<ExactSchemePayload> {
    const networkId = requirements.network as NetworkId;
    const network = getNetwork(networkId);
    const client = this.getWalletClient(networkId);

    const amount = options?.amount 
      ? String(options.amount) 
      : requirements.maxAmountRequired;
    
    const validityWindow = options?.validityWindow ?? 300;
    const now = Math.floor(Date.now() / 1000);
    const validAfter = (now - 60).toString(); // 1 minute ago (clock skew tolerance)
    const validBefore = (now + validityWindow).toString();
    const nonce = this.generateNonce();

    // EIP-712 domain for USDC
    const domain = {
      name: requirements.extra?.name ?? 'USD Coin',
      version: requirements.extra?.version ?? '2',
      chainId: network.chain.id,
      verifyingContract: requirements.asset as Address,
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const message = {
      from: this.account.address,
      to: requirements.payTo as Address,
      value: BigInt(amount),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: nonce,
    };

    // Sign the typed data
    const signature = await client.signTypedData({
      account: this.account,
      domain,
      types,
      primaryType: 'TransferWithAuthorization',
      message,
    });

    return {
      signature,
      authorization: {
        from: this.account.address,
        to: requirements.payTo,
        value: amount,
        validAfter,
        validBefore,
        nonce,
      },
    };
  }

  /**
   * Sign an upto scheme authorization
   * Same as exact but with metering metadata
   */
  async signUptoAuthorization(
    requirements: PaymentRequirements,
    metering: {
      unit: string;
      pricePerUnit: string;
      maxUnits: string;
    },
    options?: {
      validityWindow?: number;
    }
  ): Promise<UptoSchemePayload> {
    // Upto scheme uses same EIP-712 signature as exact
    // The value represents the MAX authorized amount
    const exactPayload = await this.signPaymentAuthorization(requirements, {
      amount: requirements.maxAmountRequired,
      validityWindow: options?.validityWindow,
    });

    return {
      signature: exactPayload.signature,
      authorization: exactPayload.authorization,
      metering,
    };
  }

  /**
   * Get token balance on a specific network
   */
  async getBalance(networkId: NetworkId): Promise<bigint> {
    const client = this.getPublicClient(networkId);
    const network = getNetwork(networkId);

    try {
      return await client.readContract({
        address: network.usdc,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [this.account.address],
      });
    } catch {
      return 0n;
    }
  }

  /**
   * Get balances across all networks
   */
  async getAllBalances(): Promise<Record<string, { balance: bigint; formatted: string }>> {
    const networks = getAllNetworks();
    const results: Record<string, { balance: bigint; formatted: string }> = {};

    const promises = networks.map(async (network: { id: NetworkId }) => {
      try {
        const balance = await this.getBalance(network.id);
        const formatted = `${(Number(balance) / 1e6).toFixed(6)} USDC`;
        results[network.id] = { balance, formatted };
      } catch {
        results[network.id] = { balance: 0n, formatted: '0.000000 USDC' };
      }
    });

    await Promise.allSettled(promises);
    return results;
  }
}
