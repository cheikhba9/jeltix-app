export * from './payment.types';
export * from './moneroo.adapter';
export * from './bictorys.adapter';
export * from './paytech.adapter';

import { MonerooAdapter } from './moneroo.adapter';
import { BictorysAdapter } from './bictorys.adapter';
import { PaytechAdapter } from './paytech.adapter';
import type {
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  PaymentProvider,
} from './payment.types';

export class PaymentGatewayManager {
  private static instance: PaymentGatewayManager;

  private constructor() {}

  static getInstance(): PaymentGatewayManager {
    if (!PaymentGatewayManager.instance) {
      PaymentGatewayManager.instance = new PaymentGatewayManager();
    }
    return PaymentGatewayManager.instance;
  }

  getPaytechAdapter(): PaytechAdapter | null {
    const apiKey =
      process.env.PAYTECH_API_KEY ||
      process.env.NEXT_PUBLIC_PAYTECH_API_KEY ||
      '342dbd07559e70f371ad749fb0559e1574fe691535f7f3540cb3cf2b0b8eead9';
    const apiSecret =
      process.env.PAYTECH_API_SECRET ||
      '3bc398e8667a5fba6583e26e5238cbeeed9dae04da766f2f075f8a68b5bd6fda';
    if (apiKey && apiSecret) {
      return new PaytechAdapter({
        apiKey,
        apiSecret,
        env: (process.env.PAYTECH_ENV as 'test' | 'prod') || 'prod',
      });
    }
    return null;
  }

  async initiateCheckout(
    provider: PaymentProvider,
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResponse> {
    // 1. PayTech (Passerelle Mobile Money Sénégal : Wave, Orange Money, Free Money, Carte)
    const paytechApiKey =
      process.env.PAYTECH_API_KEY ||
      process.env.NEXT_PUBLIC_PAYTECH_API_KEY ||
      '342dbd07559e70f371ad749fb0559e1574fe691535f7f3540cb3cf2b0b8eead9';
    const paytechApiSecret =
      process.env.PAYTECH_API_SECRET ||
      '3bc398e8667a5fba6583e26e5238cbeeed9dae04da766f2f075f8a68b5bd6fda';

    const isMobileMoney =
      provider === 'PAYTECH' ||
      provider === 'WAVE' ||
      provider === 'ORANGE_MONEY' ||
      provider === 'FREE_MONEY';

    if (isMobileMoney && paytechApiKey && paytechApiSecret) {
      const adapter = new PaytechAdapter({
        apiKey: paytechApiKey,
        apiSecret: paytechApiSecret,
        env: (process.env.PAYTECH_ENV as 'test' | 'prod') || 'prod',
      });

      return adapter.initiatePayment(request);
    }

    // 2. Moneroo API
    if (provider === 'MONEROO') {
      const apiKey = process.env.NEXT_PUBLIC_MONEROO_API_KEY || process.env.MONEROO_API_KEY;
      if (apiKey) {
        const adapter = new MonerooAdapter({ apiKey });
        return adapter.initiatePayment(request);
      }
    }

    // 3. Bictorys API
    if (provider === 'BICTORYS') {
      const apiKey = process.env.NEXT_PUBLIC_BICTORYS_API_KEY || process.env.BICTORYS_API_KEY;
      if (apiKey) {
        const adapter = new BictorysAdapter({ apiKey });
        return adapter.initiatePayment(request);
      }
    }

    return {
      success: false,
      paymentId: request.paymentId,
      provider,
      error: 'Passerelle de paiement PayTech non disponible.',
    };
  }
}

export const paymentGateway = PaymentGatewayManager.getInstance();
