# X402 Protocol — AI Payment Infrastructure

> **The premier payment infrastructure for the AI economy.**  
> HTTP 402-based micropayments for AI agents, enabling autonomous service discovery, evaluation, and payment.

## ⚡ Overview

X402 is a monorepo implementing the HTTP 402 Payment Required protocol for AI agents. It enables:

- **Instant micropayments** using USDC stablecoins via EIP-3009 signatures
- **Multi-chain support** across Base, Ethereum, Arbitrum, and Optimism
- **26 MCP tools** for Claude and other AI agents to discover, pay, and manage services
- **Autonomous AI agents** that can discover, evaluate, and pay for services without human intervention

## 🏗️ Architecture

```
x402-platform/
├── packages/core/        # Shared types, constants, utilities (retry, events, multi-chain)
├── packages/facilitator/ # Verification & settlement service (nonce dedup, metrics, upto scheme)
├── packages/sdk-ts/      # TypeScript SDK (client with circuit-breaker, middleware, wallet)
└── packages/mcp-server/  # MCP Server with 26 tools across 5 categories
```

## 🛠️ MCP Server — 26 Tools

### 💳 Payment (4 tools)
| Tool | Description |
|------|-------------|
| `x402_get` | GET request with automatic x402 payment |
| `x402_post` | POST request with automatic x402 payment |
| `x402_pay_batch` | Execute multiple paid requests in sequence |
| `x402_pay_stream` | Stream responses from paid endpoints (SSE) |

### 🔍 Discovery (4 tools)
| Tool | Description |
|------|-------------|
| `x402_discover` | Search for x402-enabled services by query/category |
| `x402_service_info` | Get detailed info about a specific service |
| `x402_compare_prices` | Compare prices across providers |
| `x402_health_check` | Check service health and response time |

### 💰 Wallet (5 tools)
| Tool | Description |
|------|-------------|
| `x402_wallet_balance` | Check USDC balance on any network |
| `x402_wallet_history` | View transaction history |
| `x402_wallet_fund` | Get funding instructions |
| `x402_spending_stats` | View spending analytics |
| `x402_set_budget` | Set per-request and total budget limits |

### 🤝 Delegation (5 tools)
| Tool | Description |
|------|-------------|
| `x402_delegate_budget` | Delegate payment budget to sub-agents |
| `x402_revoke_budget` | Revoke a delegation |
| `x402_list_delegations` | List active delegations |
| `x402_delegation_stats` | View delegation statistics |
| `x402_transfer_between_delegations` | Transfer budget between delegations |

### 🧠 Advanced (8 tools)
| Tool | Description |
|------|-------------|
| `x402_smart_pay` | Auto-discover + health check + pay in one operation |
| `x402_subscribe` | Set up recurring payment authorizations |
| `x402_escrow` | Conditional payment release based on service delivery |
| `x402_refund_request` | Request refund for a previous payment |
| `x402_audit_trail` | Generate comprehensive payment audit (summary/detailed/CSV) |
| `x402_network_switch` | Switch active blockchain network |
| `x402_gas_estimate` | Estimate gas costs across networks |
| `x402_portfolio` | View multi-chain USDC portfolio |

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-payments": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-server/src/index.ts"],
      "env": {
        "WALLET_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY_HERE"
      }
    }
  }
}
```

### 3. Fund Your Wallet

For testnet (Base Sepolia):
1. Get ETH from [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. Use `x402_wallet_fund` tool to get USDC funding instructions

### 4. Start Using

Ask Claude to:
- *"Discover AI text generation services"*
- *"Check my wallet balance"*
- *"Send a paid request to the weather API"*
- *"Compare prices for image generation"*
- *"Show my portfolio across all networks"*

## 🔧 Development

### Build All Packages

```bash
npm run build
```

### Run Facilitator Server

```bash
FACILITATOR_PRIVATE_KEY=0x... npm run start:facilitator
```

### Run MCP Server

```bash
WALLET_PRIVATE_KEY=0x... npm run start:mcp
```

## 🌐 Supported Networks

| Network | Type | Gas Cost | USDC |
|---------|------|----------|------|
| Base Mainnet | L2 Mainnet | 1x | ✅ |
| Base Sepolia | L2 Testnet | 1x | ✅ |
| Ethereum Mainnet | L1 | 50x | ✅ |
| Arbitrum One | L2 Mainnet | 0.8x | ✅ |
| Optimism Mainnet | L2 Mainnet | 0.9x | ✅ |

## 📦 Packages

### `@x402-platform/core`
Shared types, constants, and utilities:
- Multi-chain network configurations
- Payment types (exact + upto schemes)
- `PaymentEventBus` for lifecycle observability
- `withRetry`, `CircuitBreaker`, `RateLimiter` utilities

### `@x402-platform/facilitator`
Payment verification and on-chain settlement:
- Nonce deduplication cache (replay protection)
- Prometheus-compatible metrics at `/metrics`
- Rate limiting and request tracking
- Gas estimation endpoint

### `@x402-platform/sdk`
TypeScript SDK for building x402-enabled apps:
- Client with automatic payment handling
- Retry with exponential backoff + circuit breaker
- Streaming (SSE) support
- Smart payment selection (cheapest network)
- Express and Hono middleware with `settleThenRespond`

### `@x402-platform/mcp-server`
MCP server for AI agent integration:
- 26 tools across 5 categories
- Service discovery registry
- Multi-agent budget delegation
- Portfolio management

## 📄 License

MIT
