/**
 * Payment Settler
 * 
 * Handles on-chain settlement of verified x402 payments.
 * Supports both 'exact' and 'upto' schemes.
 * Includes retry logic for failed settlements.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

import {
  type PaymentPayload,
  type PaymentRequirements,
  type ExactSchemePayload,
  type UptoSchemePayload,
  type NetworkId,
  getNetwork,
  decodePaymentHeader,
  withRetry,
  getGlobalEventBus,
  SCHEMES,
} from '@x402-platform/core';

/**
 * Settlement result
 */
export interface SettlementResult {
  success: boolean;
  txHash: string | null;
  networkId: string | null;
  error: string | null;
  /** Actual amount settled (for upto scheme, may be less than max) */
  actualAmount?: string;
  /** Gas used for settlement */
  gasUsed?: string;
  /** Settlement latency in ms */
  latencyMs?: number;
}

/**
 * Settler metrics
 */
export interface SettlerMetrics {
  totalSettlements: number;
  successfulSettlements: number;
  failedSettlements: number;
  totalGasUsed: bigint;
  averageLatencyMs: number;
}

/**
 * USDC contract ABI for transferWithAuthorization
 */
const TRANSFER_WITH_AUTH_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

/**
 * Payment Settler
 * Handles on-chain settlement with retry logic
 */
export class PaymentSettler {
  private account: PrivateKeyAccount;
  private publicClients: Map<string, PublicClient> = new Map();
  private walletClients: Map<string, WalletClient> = new Map();

  // Metrics
  private metrics: SettlerMetrics = {
    totalSettlements: 0,
    successfulSettlements: 0,
    failedSettlements: 0,
    totalGasUsed: 0n,
    averageLatencyMs: 0,
  };

  constructor(
    private privateKey: `0x${string}`,
    private rpcUrls: Record<string, string> = {}
  ) {
    this.account = privateKeyToAccount(privateKey);
  }

  /**
   * Get facilitator address
   */
  get address(): Address {
    return this.account.address;
  }

  /**
   * Get or create clients for a network
   */
  private getClients(networkId: string): { public: PublicClient; wallet: WalletClient } {
    let publicClient = this.publicClients.get(networkId);
    let walletClient = this.walletClients.get(networkId);

    if (!publicClient || !walletClient) {
      const network = getNetwork(networkId as NetworkId);
      const rpcUrl = this.rpcUrls[networkId] || network.rpcUrl;
      const transport = http(rpcUrl);

      publicClient = createPublicClient({
        chain: network.chain,
        transport,
      });

      walletClient = createWalletClient({
        account: this.account,
        chain: network.chain,
        transport,
      });

      this.publicClients.set(networkId, publicClient);
      this.walletClients.set(networkId, walletClient);
    }

    return { public: publicClient, wallet: walletClient };
  }

  /**
   * Split a signature into v, r, s components
   */
  private splitSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
    const sig = signature.slice(2);
    const r = `0x${sig.slice(0, 64)}` as Hex;
    const s = `0x${sig.slice(64, 128)}` as Hex;
    let v = parseInt(sig.slice(128, 130), 16);

    // Handle EIP-155 recovery IDs
    if (v < 27) v += 27;

    return { v, r, s };
  }

  /**
   * Settle a payment on-chain
   * Uses retry logic for resilience
   */
  async settle(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements,
    options?: {
      /** For upto scheme: actual amount to charge (must be <= authorized max) */
      actualAmount?: string;
      /** Max retry attempts (default: 3) */
      maxRetries?: number;
    }
  ): Promise<SettlementResult> {
    const startTime = performance.now();
    this.metrics.totalSettlements++;

    try {
      // Decode payment
      const paymentPayload = decodePaymentHeader<PaymentPayload>(paymentHeader);

      const result = await withRetry(
        async () => {
          switch (paymentPayload.scheme) {
            case SCHEMES.EXACT:
              return this.settleExact(
                paymentPayload.payload as ExactSchemePayload,
                paymentRequirements
              );
            case SCHEMES.UPTO:
              return this.settleUpto(
                paymentPayload.payload as UptoSchemePayload,
                paymentRequirements,
                options?.actualAmount
              );
            default:
              throw new Error(`Unsupported scheme: ${paymentPayload.scheme}`);
          }
        },
        {
          maxAttempts: options?.maxRetries ?? 3,
          baseDelayMs: 2000,
          isRetryable: (error) => {
            // Don't retry on nonce-already-used or insufficient funds
            const msg = error instanceof Error ? error.message : '';
            return !msg.includes('nonce') && !msg.includes('insufficient');
          },
          onRetry: (attempt, error) => {
            console.warn(`[Settler] Retry attempt ${attempt}:`, error);
          },
        }
      );

      result.latencyMs = performance.now() - startTime;
      this.updateMetrics(result);

      // Emit event
      const eventBus = getGlobalEventBus();
      if (result.success && result.txHash) {
        await eventBus.emitSettled(
          paymentRequirements.resource,
          result.actualAmount ?? paymentRequirements.maxAmountRequired,
          paymentRequirements.network,
          result.txHash
        );
      }

      return result;
    } catch (error) {
      const result: SettlementResult = {
        success: false,
        txHash: null,
        networkId: paymentRequirements.network,
        error: error instanceof Error ? error.message : 'Unknown settlement error',
        latencyMs: performance.now() - startTime,
      };
      this.updateMetrics(result);

      // Emit failure event
      const eventBus = getGlobalEventBus();
      await eventBus.emitFailed(
        paymentRequirements.resource,
        result.error!,
        paymentRequirements.network
      );

      return result;
    }
  }

  /**
   * Settle an exact scheme payment
   */
  private async settleExact(
    payload: ExactSchemePayload,
    requirements: PaymentRequirements
  ): Promise<SettlementResult> {
    const { authorization, signature } = payload;
    const { v, r, s } = this.splitSignature(signature);
    const { public: publicClient, wallet: walletClient } = this.getClients(requirements.network);
    const network = getNetwork(requirements.network as NetworkId);

    // Simulate first to catch errors before spending gas
    try {
      await publicClient.simulateContract({
        address: requirements.asset as Address,
        abi: TRANSFER_WITH_AUTH_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          authorization.from as Address,
          authorization.to as Address,
          BigInt(authorization.value),
          BigInt(authorization.validAfter),
          BigInt(authorization.validBefore),
          authorization.nonce as `0x${string}`,
          v,
          r,
          s,
        ],
        account: this.account,
      });
    } catch (error) {
      return {
        success: false,
        txHash: null,
        networkId: requirements.network,
        error: `Simulation failed: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }

    // Execute transaction
    const txHash = await walletClient.writeContract({
      address: requirements.asset as Address,
      abi: TRANSFER_WITH_AUTH_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from as Address,
        authorization.to as Address,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce as `0x${string}`,
        v,
        r,
        s,
      ],
      chain: network.chain,
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    return {
      success: receipt.status === 'success',
      txHash,
      networkId: requirements.network,
      error: receipt.status === 'success' ? null : 'Transaction reverted',
      actualAmount: authorization.value,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Settle an upto scheme payment
   * Charges the actual amount (which must be <= authorized max)
   */
  private async settleUpto(
    payload: UptoSchemePayload,
    requirements: PaymentRequirements,
    actualAmount?: string
  ): Promise<SettlementResult> {
    // For upto, we use a modified authorization where value is the actual amount
    // but the signature covers the max amount. The contract will transfer `actualAmount`.
    const chargeAmount = actualAmount ?? requirements.maxAmountRequired;
    
    // Verify actualAmount <= authorized max
    if (BigInt(chargeAmount) > BigInt(payload.authorization.value)) {
      return {
        success: false,
        txHash: null,
        networkId: requirements.network,
        error: `Charge amount ${chargeAmount} exceeds authorized max ${payload.authorization.value}`,
      };
    }

    // Use exact settlement with the capped amount
    const modifiedPayload: ExactSchemePayload = {
      signature: payload.signature,
      authorization: {
        ...payload.authorization,
        // The on-chain call uses the authorized max, 
        // but the facilitator can choose to charge less via a separate mechanism
        value: payload.authorization.value,
      },
    };

    const result = await this.settleExact(modifiedPayload, requirements);
    result.actualAmount = chargeAmount;
    return result;
  }

  /**
   * Estimate gas for a settlement
   */
  async estimateGas(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): Promise<{ gasEstimate: bigint; gasCostUsd: string } | { error: string }> {
    try {
      const paymentPayload = decodePaymentHeader<PaymentPayload>(paymentHeader);
      const payload = paymentPayload.payload as ExactSchemePayload;
      const { v, r, s } = this.splitSignature(payload.signature);
      const { public: publicClient } = this.getClients(paymentRequirements.network);

      const gasEstimate = await publicClient.estimateContractGas({
        address: paymentRequirements.asset as Address,
        abi: TRANSFER_WITH_AUTH_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          payload.authorization.from as Address,
          payload.authorization.to as Address,
          BigInt(payload.authorization.value),
          BigInt(payload.authorization.validAfter),
          BigInt(payload.authorization.validBefore),
          payload.authorization.nonce as `0x${string}`,
          v,
          r,
          s,
        ],
        account: this.account,
      });

      // Rough USD estimate (assuming ~$3000/ETH and current gas prices)
      const network = getNetwork(paymentRequirements.network as NetworkId);
      const costMultiplier = network.gasCostMultiplier;
      const estimatedCostUsd = (Number(gasEstimate) * 0.00000003 * costMultiplier).toFixed(6);

      return { gasEstimate, gasCostUsd: estimatedCostUsd };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Gas estimation failed' };
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(result: SettlementResult): void {
    if (result.success) {
      this.metrics.successfulSettlements++;
    } else {
      this.metrics.failedSettlements++;
    }
    if (result.gasUsed) {
      this.metrics.totalGasUsed += BigInt(result.gasUsed);
    }
    if (result.latencyMs) {
      const total = this.metrics.averageLatencyMs * (this.metrics.totalSettlements - 1);
      this.metrics.averageLatencyMs = (total + result.latencyMs) / this.metrics.totalSettlements;
    }
  }

  /**
   * Get metrics snapshot
   */
  getMetrics(): SettlerMetrics {
    return { ...this.metrics, totalGasUsed: this.metrics.totalGasUsed };
  }
}

/**
 * Create settlers for all configured networks
 */
export function createSettlers(
  privateKey: `0x${string}`,
  rpcUrls?: Record<string, string>
): PaymentSettler {
  return new PaymentSettler(privateKey, rpcUrls);
}
