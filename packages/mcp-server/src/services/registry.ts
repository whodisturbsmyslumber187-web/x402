/**
 * Service Registry
 * 
 * In-memory registry of x402-enabled services.
 * Supports search, health checking, and categorization.
 * 
 * In production, this would connect to a live discovery service.
 */

/**
 * Registered service
 */
export interface RegisteredService {
  name: string;
  url: string;
  category: string;
  description: string;
  price: string;
  network: string;
  tags: string[];
  status: 'active' | 'inactive' | 'unknown';
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  responseTimeMs: number;
  lastChecked: Date;
  error?: string;
}

/**
 * Service Registry
 */
export class ServiceRegistry {
  private services: RegisteredService[] = [];
  private healthCache: Map<string, HealthCheckResult> = new Map();

  constructor() {
    this.loadDefaultServices();
  }

  /**
   * Load default service registry
   */
  private loadDefaultServices(): void {
    this.services = [
      // AI Services
      {
        name: 'GPT-4 Turbo API',
        url: 'https://api.x402.ai/v1/gpt4',
        category: 'ai',
        description: 'OpenAI GPT-4 Turbo text generation via x402 payment',
        price: '0.01 USDC/request',
        network: 'base-mainnet',
        tags: ['ai', 'text', 'llm', 'gpt4'],
        status: 'active',
      },
      {
        name: 'Claude 3.5 Sonnet API',
        url: 'https://api.x402.ai/v1/claude',
        category: 'ai',
        description: 'Anthropic Claude 3.5 text generation via x402',
        price: '0.02 USDC/request',
        network: 'base-mainnet',
        tags: ['ai', 'text', 'llm', 'claude'],
        status: 'active',
      },
      {
        name: 'DALL-E 3 Image Generation',
        url: 'https://api.x402.ai/v1/dalle',
        category: 'ai',
        description: 'AI image generation via x402 micropayment',
        price: '0.05 USDC/image',
        network: 'base-mainnet',
        tags: ['ai', 'image', 'generation', 'dalle'],
        status: 'active',
      },
      {
        name: 'Whisper Transcription',
        url: 'https://api.x402.ai/v1/whisper',
        category: 'ai',
        description: 'Audio-to-text transcription via x402',
        price: '0.005 USDC/minute',
        network: 'base-mainnet',
        tags: ['ai', 'audio', 'transcription'],
        status: 'active',
      },

      // Data Services
      {
        name: 'Premium Weather Data',
        url: 'https://weather.x402.services/v1/forecast',
        category: 'data',
        description: 'High-resolution weather forecasts with 15-min granularity',
        price: '0.001 USDC/request',
        network: 'base-sepolia',
        tags: ['weather', 'data', 'forecast'],
        status: 'active',
      },
      {
        name: 'Crypto Market Data',
        url: 'https://market.x402.services/v1/prices',
        category: 'data',
        description: 'Real-time cryptocurrency prices and analytics',
        price: '0.002 USDC/request',
        network: 'base-mainnet',
        tags: ['crypto', 'market', 'prices', 'data'],
        status: 'active',
      },
      {
        name: 'Web Scraping API',
        url: 'https://scraper.x402.services/v1/extract',
        category: 'data',
        description: 'Structured web scraping and data extraction',
        price: '0.01 USDC/page',
        network: 'base-mainnet',
        tags: ['scraping', 'web', 'data', 'extraction'],
        status: 'active',
      },

      // Infrastructure
      {
        name: 'IPFS Pinning Service',
        url: 'https://ipfs.x402.services/v1/pin',
        category: 'storage',
        description: 'Pin files to IPFS with x402 micropayments',
        price: '0.001 USDC/MB/month',
        network: 'base-mainnet',
        tags: ['ipfs', 'storage', 'pinning', 'decentralized'],
        status: 'active',
      },
      {
        name: 'Email Sending API',
        url: 'https://email.x402.services/v1/send',
        category: 'communication',
        description: 'Send transactional emails with x402 payment',
        price: '0.0005 USDC/email',
        network: 'base-mainnet',
        tags: ['email', 'communication', 'messaging'],
        status: 'active',
      },

      // Compute
      {
        name: 'Serverless Function Execution',
        url: 'https://compute.x402.services/v1/execute',
        category: 'compute',
        description: 'Run serverless functions paid per execution',
        price: '0.003 USDC/execution',
        network: 'arbitrum-one',
        tags: ['compute', 'serverless', 'function'],
        status: 'active',
      },
      {
        name: 'GPU Inference Endpoint',
        url: 'https://gpu.x402.services/v1/infer',
        category: 'compute',
        description: 'GPU compute for ML inference, paid per second',
        price: '0.01 USDC/second',
        network: 'base-mainnet',
        tags: ['gpu', 'compute', 'inference', 'ml'],
        status: 'active',
      },
    ];
  }

  /**
   * Search services by query
   */
  search(query?: string, category?: string): RegisteredService[] {
    let results = this.services;

    if (category) {
      results = results.filter(s => s.category === category);
    }

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.includes(q)) ||
        s.category.includes(q)
      );
    }

    return results;
  }

  /**
   * Get a service by URL
   */
  getByUrl(url: string): RegisteredService | undefined {
    return this.services.find(s => s.url === url);
  }

  /**
   * Register a new service
   */
  register(service: RegisteredService): void {
    const existing = this.services.findIndex(s => s.url === service.url);
    if (existing >= 0) {
      this.services[existing] = service;
    } else {
      this.services.push(service);
    }
  }

  /**
   * Check service health
   */
  async checkHealth(url: string): Promise<HealthCheckResult> {
    const cached = this.healthCache.get(url);
    if (cached && Date.now() - cached.lastChecked.getTime() < 60000) {
      return cached;
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const result: HealthCheckResult = {
        healthy: response.status < 500,
        responseTimeMs: Math.round(performance.now() - start),
        lastChecked: new Date(),
      };

      this.healthCache.set(url, result);
      return result;
    } catch (err) {
      const result: HealthCheckResult = {
        healthy: false,
        responseTimeMs: Math.round(performance.now() - start),
        lastChecked: new Date(),
        error: err instanceof Error ? err.message : 'Health check failed',
      };

      this.healthCache.set(url, result);
      return result;
    }
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return [...new Set(this.services.map(s => s.category))];
  }
}
