/**
 * Example X402-Enabled API Server
 * 
 * This demonstrates how to monetize your API endpoints using x402.
 * 
 * Run with: npm run dev
 */

import express from 'express';
import { createX402Middleware } from '@x402-platform/sdk/server';
import { getNetwork, SCHEMES } from '@x402-platform/core';

const app = express();
app.use(express.json());

// ============================================
// X402 MIDDLEWARE CONFIGURATION
// ============================================

const facilitatorUrl = process.env['FACILITATOR_URL'] || 'http://localhost:3001';
const network = getNetwork('base-sepolia');
const payTo = (process.env['WALLET_ADDRESS'] || '0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab3a') as `0x${string}`;

app.use(createX402Middleware({
  facilitatorUrl,
  routes: {
    'POST /api/generate': {
      facilitatorUrl,
      requirements: {
        scheme: SCHEMES.EXACT,
        network: network.id,
        maxAmountRequired: '10000',
        resource: '/api/generate',
        description: 'AI text generation',
        mimeType: 'application/json',
        payTo,
        maxTimeoutSeconds: 60,
        asset: network.usdc,
      },
    },
    'GET /api/data/*': {
      facilitatorUrl,
      requirements: {
        scheme: SCHEMES.EXACT,
        network: network.id,
        maxAmountRequired: '1000',
        resource: '/api/data/*',
        description: 'Premium data access',
        mimeType: 'application/json',
        payTo,
        maxTimeoutSeconds: 60,
        asset: network.usdc,
      },
    },
    'POST /api/image': {
      facilitatorUrl,
      requirements: {
        scheme: SCHEMES.EXACT,
        network: network.id,
        maxAmountRequired: '50000',
        resource: '/api/image',
        description: 'AI image generation',
        mimeType: 'application/json',
        payTo,
        maxTimeoutSeconds: 60,
        asset: network.usdc,
      },
    },
  },
}));

// ============================================
// FREE ENDPOINTS (No payment required)
// ============================================

app.get('/', (_req, res) => {
  res.json({
    name: 'X402 Example API',
    version: '1.0.0',
    endpoints: {
      free: [
        'GET /',
        'GET /health',
      ],
      paid: [
        'POST /api/generate - AI text generation (0.01 USDC)',
        'GET /api/data/:id - Premium data (0.001 USDC)',
        'POST /api/image - Image generation (0.05 USDC)',
      ],
    },
    payment: {
      network: 'base-sepolia',
      token: 'USDC',
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// PAID ENDPOINTS
// ============================================

// AI Text Generation
app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  
  // Payment already verified by middleware!
  // You can access payment info via (req as any).x402
  
  // Simulate AI generation
  await new Promise(resolve => setTimeout(resolve, 500));
  
  res.json({
    prompt,
    result: `Generated response for: "${prompt}". This content was paid for via x402!`,
    model: 'example-gpt-1.0',
    tokens: 150,
    paid: true,
  });
});

// Premium Data Access
app.get('/api/data/:id', async (req, res) => {
  const { id } = req.params;
  
  // Payment verified - serve premium data
  res.json({
    id,
    data: {
      title: `Premium Dataset ${id}`,
      records: 10000,
      lastUpdated: new Date().toISOString(),
      content: 'This is premium data only accessible after x402 payment.',
    },
    paid: true,
  });
});

// Image Generation
app.post('/api/image', async (req, res) => {
  const { prompt, size = '512x512' } = req.body;
  
  // Simulate image generation
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  res.json({
    prompt,
    size,
    url: `https://example.com/generated/${Date.now()}.png`,
    message: 'Image generated successfully via x402 payment!',
    paid: true,
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = parseInt(process.env['PORT'] || '3000', 10);

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              X402 Example API Server                          ║
╠══════════════════════════════════════════════════════════════╣
║  URL: http://localhost:${PORT.toString().padEnd(44)}║
║  Network: base-sepolia (testnet)                              ║
╠══════════════════════════════════════════════════════════════╣
║  Free Endpoints:                                              ║
║    GET  /           - API info                                ║
║    GET  /health     - Health check                            ║
║                                                               ║
║  Paid Endpoints:                                              ║
║    POST /api/generate  - 0.01 USDC                            ║
║    GET  /api/data/:id  - 0.001 USDC                           ║
║    POST /api/image     - 0.05 USDC                            ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
