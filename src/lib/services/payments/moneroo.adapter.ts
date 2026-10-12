import type {
  PaymentGatewayAdapter,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  WebhookVerificationResult,
} from './payment.types';

export interface MonerooConfig {
  apiKey: string;
  webhookSecret?: string;
  isTestMode?: boolean;
}

export class MonerooAdapter implements PaymentGatewayAdapter {
  readonly provider = 'MONEROO' as const;
  private config: MonerooConfig;

  constructor(config: MonerooConfig) {
    this.config = config;
  }

  async initiatePayment(req: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const endpoint = 'https://api.moneroo.io/v1/payments/initialize';

    const payload = {
      amount: Math.round(req.amount),
      currency: req.currency,
      description: req.description,
      customer: {
        first_name: req.customerName.split(' ')[0] || req.customerName,
        last_name: req.customerName.split(' ').slice(1).join(' ') || 'Client',
        email: req.customerEmail || 'client@jeltix.sn',
        phone: req.customerPhone,
      },
      return_url: req.returnUrl,
      metadata: {
        paymentId: req.paymentId,
        ...req.metadata,
      },
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.data?.checkout_url) {
        return {
          success: false,
          paymentId: req.paymentId,
          provider: this.provider,
          error: data?.message || `Erreur Moneroo HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        paymentId: req.paymentId,
        provider: this.provider,
        checkoutUrl: data.data.checkout_url,
        providerReference: data.data.id,
      };
    } catch (err: any) {
      return {
        success: false,
        paymentId: req.paymentId,
        provider: this.provider,
        error: err.message || 'Impossible de contacter les serveurs de paiement Moneroo',
      };
    }
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerificationResult> {
    try {
      const parsed = JSON.parse(rawBody);
      const eventData = parsed?.data || parsed;
      const paymentId = eventData?.metadata?.paymentId || '';
      const status = eventData?.status === 'success' || eventData?.status === 'completed' ? 'SUCCESS' : 'PENDING';

      return {
        isValid: true,
        paymentId,
        providerReference: eventData?.id,
        amountPaid: Number(eventData?.amount || 0),
        status,
        rawPayload: parsed,
      };
    } catch (err: any) {
      return {
        isValid: false,
        paymentId: '',
        amountPaid: 0,
        status: 'FAILED',
        rawPayload: null,
        error: err.message,
      };
    }
  }
}
