import type {
  PaymentGatewayAdapter,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  WebhookVerificationResult,
} from './payment.types';

export interface BictorysConfig {
  apiKey: string;
  webhookSecret?: string;
  isSandbox?: boolean;
}

export class BictorysAdapter implements PaymentGatewayAdapter {
  readonly provider = 'BICTORYS' as const;
  private config: BictorysConfig;

  constructor(config: BictorysConfig) {
    this.config = config;
  }

  async initiatePayment(req: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const baseUrl = this.config.isSandbox
      ? 'https://api.sandbox.bictorys.com'
      : 'https://api.bictorys.com';
    const endpoint = `${baseUrl}/v1/payments`;

    const payload = {
      paymentReference: req.paymentId,
      amount: Math.round(req.amount),
      currency: 'XOF',
      description: req.description,
      customer: {
        name: req.customerName,
        phone: req.customerPhone,
        email: req.customerEmail || 'client@jeltix.sn',
      },
      successUrl: req.returnUrl,
      cancelUrl: req.cancelUrl,
      metadata: req.metadata,
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Api-Key': this.config.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || (!data?.checkoutUrl && !data?.paymentUrl)) {
        return {
          success: false,
          paymentId: req.paymentId,
          provider: this.provider,
          error: data?.message || `Erreur Bictorys HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        paymentId: req.paymentId,
        provider: this.provider,
        checkoutUrl: data.checkoutUrl || data.paymentUrl,
        providerReference: data.id || data.paymentId,
      };
    } catch (err: any) {
      return {
        success: false,
        paymentId: req.paymentId,
        provider: this.provider,
        error: err.message || 'Impossible de contacter les serveurs Bictorys',
      };
    }
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerificationResult> {
    try {
      const parsed = JSON.parse(rawBody);
      const paymentId = parsed?.paymentReference || parsed?.reference || '';
      const status = parsed?.status === 'SUCCESS' || parsed?.status === 'PAID' ? 'SUCCESS' : 'PENDING';

      return {
        isValid: true,
        paymentId,
        providerReference: parsed?.id || parsed?.transactionId,
        amountPaid: Number(parsed?.amount || 0),
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
