/**
 * X402 Server Middleware
 * 
 * Middleware for monetizing API routes with x402 payments.
 * Supports both Express-style and Hono middleware patterns.
 * 
 * Features:
 * - settleThenRespond option for payment settlement before response
 * - Multiple payment options per route
 * - Request logging hooks
 * - Hono adapter
 */

import {
  type PaymentRequirements,
  type PaymentResponse,
  encodePaymentHeader,
  X402_VERSION,
  HEADERS,
  STATUS_CODES,
} from '@x402-platform/core';

/**
 * Route payment configuration
 */
export interface RoutePaymentConfig {
  /** Payment requirements for this route */
  requirements: PaymentRequirements | PaymentRequirements[];
  
  /** Facilitator URL for verification/settlement */
  facilitatorUrl: string;
  
  /** Whether to settle before responding (default: false = verify only) */
  settleThenRespond?: boolean;

  /** Called on successful payment */
  onPayment?: (info: { amount: string; from: string; txHash?: string }) => void;
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Default facilitator URL */
  facilitatorUrl: string;
  
  /** Route-specific payment configs (matched by path) */
  routes: Record<string, RoutePaymentConfig>;

  /** Global onPayment hook */
  onPayment?: (info: { path: string; amount: string; from: string }) => void;
}

/**
 * Create x402 middleware for any framework (generic)
 * Returns a handler function that can be adapted to Express, Hono, etc.
 */
export function createX402Middleware(config: MiddlewareConfig) {
  /**
   * Verify payment with facilitator
   */
  async function verifyPayment(
    paymentHeader: string,
    requirements: PaymentRequirements,
    facilitatorUrl: string
  ): Promise<{ isValid: boolean; invalidReason?: string }> {
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: X402_VERSION,
        paymentHeader,
        paymentRequirements: requirements,
      }),
    });
    return response.json();
  }

  /**
   * Settle payment with facilitator
   */
  async function settlePayment(
    paymentHeader: string,
    requirements: PaymentRequirements,
    facilitatorUrl: string,
    actualAmount?: string
  ): Promise<PaymentResponse> {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: X402_VERSION,
        paymentHeader,
        paymentRequirements: requirements,
        actualAmount,
      }),
    });
    return response.json();
  }

  /**
   * Express-compatible middleware
   */
  function expressMiddleware(
    req: { path: string; headers: Record<string, string | string[] | undefined>; method: string },
    res: {
      status: (code: number) => { json: (data: unknown) => void };
      setHeader: (key: string, value: string) => void;
    },
    next: () => void
  ): void {
    const routeConfig = config.routes[req.path];
    if (!routeConfig) {
      next();
      return;
    }

    const paymentHeader = req.headers[HEADERS.PAYMENT.toLowerCase()] as string | undefined;

    if (!paymentHeader) {
      // Return 402 with payment requirements
      const requirements = Array.isArray(routeConfig.requirements) 
        ? routeConfig.requirements 
        : [routeConfig.requirements];

      res.status(STATUS_CODES.PAYMENT_REQUIRED).json({
        x402Version: X402_VERSION,
        accepts: requirements,
        error: 'Payment required',
      });
      return;
    }

    // Verify payment
    const requirements = Array.isArray(routeConfig.requirements) 
      ? routeConfig.requirements[0]! 
      : routeConfig.requirements;
    const facilitatorUrl = routeConfig.facilitatorUrl || config.facilitatorUrl;

    if (routeConfig.settleThenRespond) {
      // Settle before responding
      settlePayment(paymentHeader, requirements, facilitatorUrl)
        .then((result) => {
          if (result.success) {
            const responseHeader = encodePaymentHeader(result);
            res.setHeader(HEADERS.PAYMENT_RESPONSE, responseHeader);
            
            routeConfig.onPayment?.({
              amount: requirements.maxAmountRequired,
              from: 'unknown',
              txHash: result.txHash ?? undefined,
            });
            config.onPayment?.({
              path: req.path,
              amount: requirements.maxAmountRequired,
              from: 'unknown',
            });
            
            next();
          } else {
            res.status(400).json({ error: `Settlement failed: ${result.error}` });
          }
        })
        .catch((error: Error) => {
          res.status(500).json({ error: `Settlement error: ${error.message}` });
        });
    } else {
      // Verify only
      verifyPayment(paymentHeader, requirements, facilitatorUrl)
        .then((result) => {
          if (result.isValid) {
            config.onPayment?.({
              path: req.path,
              amount: requirements.maxAmountRequired,
              from: 'unknown',
            });
            next();
          } else {
            res.status(400).json({ 
              error: `Payment verification failed: ${result.invalidReason}` 
            });
          }
        })
        .catch((error: Error) => {
          res.status(500).json({ error: `Verification error: ${error.message}` });
        });
    }
  }

  return expressMiddleware;
}

/**
 * Hono middleware adapter
 */
export function x402Hono(routeConfig: RoutePaymentConfig) {
  return async (c: {
    req: { header: (name: string) => string | undefined };
    json: (data: unknown, status?: number) => Response;
    header: (name: string, value: string) => void;
  }, next: () => Promise<void>) => {
    const paymentHeader = c.req.header(HEADERS.PAYMENT);

    if (!paymentHeader) {
      const requirements = Array.isArray(routeConfig.requirements)
        ? routeConfig.requirements
        : [routeConfig.requirements];

      return c.json({
        x402Version: X402_VERSION,
        accepts: requirements,
        error: 'Payment required',
      }, STATUS_CODES.PAYMENT_REQUIRED);
    }

    const requirements = Array.isArray(routeConfig.requirements)
      ? routeConfig.requirements[0]!
      : routeConfig.requirements;

    if (routeConfig.settleThenRespond) {
      const result = await settlePaymentDirect(
        paymentHeader,
        requirements,
        routeConfig.facilitatorUrl
      );

      if (result.success) {
        c.header(HEADERS.PAYMENT_RESPONSE, encodePaymentHeader(result));
        routeConfig.onPayment?.({
          amount: requirements.maxAmountRequired,
          from: 'unknown',
          txHash: result.txHash ?? undefined,
        });
        await next();
      } else {
        return c.json({ error: `Settlement failed: ${result.error}` }, 400);
      }
    } else {
      const result = await verifyPaymentDirect(
        paymentHeader,
        requirements,
        routeConfig.facilitatorUrl
      );

      if (result.isValid) {
        await next();
      } else {
        return c.json({ error: `Verification failed: ${result.invalidReason}` }, 400);
      }
    }
  };
}

/**
 * Express middleware shortcut
 */
export function x402Express(routeConfig: RoutePaymentConfig) {
  return (
    req: { path: string; headers: Record<string, string | string[] | undefined>; method: string },
    res: {
      status: (code: number) => { json: (data: unknown) => void };
      setHeader: (key: string, value: string) => void;
    },
    next: () => void
  ) => {
    const config: MiddlewareConfig = {
      facilitatorUrl: routeConfig.facilitatorUrl,
      routes: { [req.path]: routeConfig },
    };
    const mw = createX402Middleware(config);
    mw(req, res, next);
  };
}

// Direct helpers for Hono adapter
async function verifyPaymentDirect(
  paymentHeader: string,
  requirements: PaymentRequirements,
  facilitatorUrl: string
): Promise<{ isValid: boolean; invalidReason?: string }> {
  const response = await fetch(`${facilitatorUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      x402Version: X402_VERSION,
      paymentHeader,
      paymentRequirements: requirements,
    }),
  });
  return response.json();
}

async function settlePaymentDirect(
  paymentHeader: string,
  requirements: PaymentRequirements,
  facilitatorUrl: string
): Promise<PaymentResponse> {
  const response = await fetch(`${facilitatorUrl}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      x402Version: X402_VERSION,
      paymentHeader,
      paymentRequirements: requirements,
    }),
  });
  return response.json();
}
