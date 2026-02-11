# @x402-platform/mcp-server

## 🚀 God Level Edition - 18 AI Agent Tools

The ultimate MCP server for AI agents to discover, interact with, and pay for x402-enabled services.

## Installation

```bash
npm install @x402-platform/mcp-server
```

## Quick Setup with Claude Desktop

Add to your Claude Desktop's MCP config (`~/.config/claude/mcp.json` or `%APPDATA%/claude/mcp.json`):

```json
{
  "mcpServers": {
    "x402": {
      "command": "npx",
      "args": ["x402-mcp-server"],
      "env": {
        "WALLET_PRIVATE_KEY": "0xYourPrivateKey",
        "MAX_SPEND_PER_REQUEST": "1000000",
        "NETWORK": "base-sepolia"
      }
    }
  }
}
```

Restart Claude Desktop and you're ready to go!

---

## 🔧 Available Tools (18 Total)

### Payment Tools (4)

| Tool | Description |
|------|-------------|
| `x402_pay` | Make a paid request to any x402 endpoint |
| `x402_pay_batch` | Execute multiple paid requests in parallel |
| `x402_estimate` | Get the price without paying |
| `x402_pay_stream` | Streaming payments for long-running tasks |

### Discovery Tools (4)

| Tool | Description |
|------|-------------|
| `x402_discover` | Search for x402 services by category/keyword |
| `x402_service_info` | Get detailed info about a service |
| `x402_compare_prices` | Compare prices across providers |
| `x402_health_check` | Check if a service is online |

### Wallet Tools (5)

| Tool | Description |
|------|-------------|
| `x402_wallet_balance` | Check USDC balance |
| `x402_wallet_history` | Get transaction history |
| `x402_wallet_fund` | Request testnet funds |
| `x402_spending_stats` | Detailed spending analytics |
| `x402_set_budget` | Set spending limits |

### Delegation Tools (5)

| Tool | Description |
|------|-------------|
| `x402_delegate_budget` | Create budget for sub-agent |
| `x402_revoke_budget` | Revoke a delegation |
| `x402_list_delegations` | List all delegations |
| `x402_delegation_stats` | Get delegation analytics |
| `x402_transfer_between_delegations` | Move budget between agents |

---

## 💬 Example Usage with Claude

Once configured, Claude can use these tools naturally:

> **You:** "Find me an AI service for image generation under $0.10 per request"

Claude will use `x402_discover` to search for services.

> **You:** "Check how much I've spent today"

Claude will use `x402_spending_stats` with period="today".

> **You:** "Use the cheapest LLM provider to summarize this document"

Claude will use `x402_compare_prices` then `x402_pay` to make the request.

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WALLET_PRIVATE_KEY` | Yes | Private key (0x...) |
| `MAX_SPEND_PER_REQUEST` | No | Max USDC per request (atomic) |
| `MAX_TOTAL_SPEND` | No | Max USDC per session |
| `TRUSTED_SERVICES` | No | Comma-separated trusted URLs |
| `NETWORK` | No | `base-mainnet` or `base-sepolia` |

---

## 🤖 Multi-Agent Workflows

Delegate budgets to sub-agents:

```
1. x402_delegate_budget(name="research-agent", amount="5.00")
   → Returns delegation ID and sub-wallet address

2. Sub-agent uses x402_pay with its delegated wallet

3. x402_delegation_stats(delegationId) 
   → See what the sub-agent spent

4. x402_revoke_budget(delegationId)
   → Reclaim unspent funds
```

---

## License

MIT
