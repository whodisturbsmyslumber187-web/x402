/**
 * Example AI Agent Using X402
 * 
 * This demonstrates how an AI agent can autonomously pay for API access.
 * 
 * Run with: npm run dev
 */

import { X402Client } from '@x402-platform/sdk/client';

// ============================================
// CONFIGURATION
// ============================================

const WALLET_PRIVATE_KEY = process.env['WALLET_PRIVATE_KEY'] as `0x${string}`;
const API_URL = process.env['API_URL'] || 'http://localhost:3000';

if (!WALLET_PRIVATE_KEY) {
  console.error('❌ WALLET_PRIVATE_KEY environment variable is required');
  console.log('   Set it to a testnet wallet private key with Base Sepolia USDC');
  process.exit(1);
}

// ============================================
// CREATE X402 CLIENT
// ============================================

const client = new X402Client({
  privateKey: WALLET_PRIVATE_KEY,
  timeout: 30000,
});

console.log(`
╔══════════════════════════════════════════════════════════════╗
║              X402 AI Agent Demo                               ║
╠══════════════════════════════════════════════════════════════╣
║  Wallet: ${client.address.slice(0, 20)}...${client.address.slice(-8).padEnd(29)}║
║  API:    ${API_URL.padEnd(50)}║
╚══════════════════════════════════════════════════════════════╝
`);

// ============================================
// OPTIONAL: SPENDING CONTROLS
// ============================================

// Set a budget limit per request (in atomic units)
const MAX_SPEND_PER_REQUEST = 100_000n; // 0.1 USDC max per request

client.setPaymentDecision((requirements) => {
  const amount = BigInt(requirements.maxAmountRequired);
  
  if (amount > MAX_SPEND_PER_REQUEST) {
    console.log(`⚠️  Declining payment: ${amount} exceeds budget of ${MAX_SPEND_PER_REQUEST}`);
    return false;
  }
  
  console.log(`💰 Approving payment: ${amount} for "${requirements.description}"`);
  return true;
});

// ============================================
// AGENT TASKS
// ============================================

async function runAgentTasks() {
  console.log('\n🤖 Starting AI Agent tasks...\n');

  try {
    // Task 1: Generate AI content
    console.log('📝 Task 1: Requesting AI generation...');
    const generateResult = await client.post<{ result: string }>(
      `${API_URL}/api/generate`,
      { prompt: 'Write a haiku about blockchain payments' }
    );
    
    console.log('   Result:', generateResult.data.result);
    console.log(`   Paid: ${generateResult.paid ? '✅ Yes' : '❌ No'}`);
    if (generateResult.amountPaid) {
      console.log(`   Amount: ${generateResult.amountPaid} (atomic units)`);
    }
    if (generateResult.txHash) {
      console.log(`   Transaction: ${generateResult.txHash}`);
    }

    // Task 2: Access premium data
    console.log('\n📊 Task 2: Accessing premium data...');
    const dataResult = await client.get<{ data: { title: string } }>(
      `${API_URL}/api/data/example-dataset-123`
    );
    
    console.log('   Result:', dataResult.data.data.title);
    console.log(`   Paid: ${dataResult.paid ? '✅ Yes' : '❌ No'}`);

    // Task 3: Generate image
    console.log('\n🎨 Task 3: Generating image...');
    const imageResult = await client.post<{ url: string; message: string }>(
      `${API_URL}/api/image`,
      { prompt: 'A futuristic payment terminal', size: '1024x1024' }
    );
    
    console.log('   Result:', imageResult.data.message);
    console.log(`   Paid: ${imageResult.paid ? '✅ Yes' : '❌ No'}`);

    console.log('\n✅ All agent tasks completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Agent task failed:', error instanceof Error ? error.message : error);
  }
}

// ============================================
// RUN THE AGENT
// ============================================

runAgentTasks().catch(console.error);
