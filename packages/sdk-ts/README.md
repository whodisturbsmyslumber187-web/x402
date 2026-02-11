# @x402-platform/sdk

The official TypeScript SDK for x402 payments.

## Installation

```bash
npm install @x402-platform/sdk
```

## Server-Side Usage (API Monetization)

Add x402 payment gates to your API endpoints:

```typescript
import express from 'express';
import { x402Express } from '@x402-platform/sdk/server';

const app = express();

// Add x402 middleware
app.use(x402Express({
  facilitator: 'https://api.x402platform.com',
  payTo: '0xYourWalletAddress',
  network: 'base-mainnet',
  routes: {
    'POST /api/generate': { 
      amount: '1000000',  // 1 USDC (6 decimals)
      description: 'AI generation' 
    },
    'GET /api/premium/*': { 
      amount: '100000',   // 0.1 USDC
      description: 'Premium data access' 
    },
  }
}));

// Your endpoints work normally
app.post('/api/generate', (req, res) => {
  // Payment already verified by middleware!
  res.json({ result: 'Generated content...' });
});

app.listen(3000);
```

## Client-Side Usage (AI Agents)

Make requests that automatically handle payments:

```typescript
import { X402Client } from '@x402-platform/sdk/client';

// Initialize with your wallet
const client = new X402Client({
  privateKey: process.env.WALLET_PRIVATE_KEY as `0x${string}`
});

// Make a paid request - payment handled automatically!
const response = await client.post('https://api.example.com/generate', {
  prompt: 'Create a marketing strategy'
});

console.log('Result:', response.data);
console.log('Paid:', response.paid);
console.log('Amount:', response.amountPaid);
console.log('Tx:', response.txHash);
```

### Payment Decision Control

Control when your agent pays:

```typescript
// Set spending limits
client.setPaymentDecision((requirements) => {
  const maxUSDC = 10_000_000n; // 10 USDC max per request
  return BigInt(requirements.maxAmountRequired) <= maxUSDC;
});

// Or ask for confirmation
client.setPaymentDecision(async (requirements) => {
  console.log(`About to pay ${requirements.maxAmountRequired} for ${requirements.description}`);
  return await promptUser('Approve this payment?');
});
```

## Direct Wallet Usage

For custom integration:

```typescript
import { X402Wallet } from '@x402-platform/sdk/client';

const wallet = new X402Wallet('0x...');

// Sign a payment authorization
const payload = await wallet.signPaymentAuthorization(paymentRequirements);

// Use payload in your own HTTP client
const paymentHeader = encodePaymentHeader({
  x402Version: 1,
  scheme: 'exact',
  network: 'base-mainnet',
  payload
});
```

## API Reference

### Server

- `x402Express(config)` - Express middleware
- `createX402Middleware(config)` - Generic middleware

### Client

- `X402Client` - HTTP client with auto-pay
- `X402Wallet` - Wallet for signing authorizations

## License

MIT
