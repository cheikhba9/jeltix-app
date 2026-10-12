export type PaymentProvider =
  | 'WAVE'
  | 'ORANGE_MONEY'
  | 'FREE_MONEY'
  | 'BICTORYS'
  | 'MONEROO'
  | 'PAYTECH'
  | 'STRIPE';

export interface PaymentInitiationRequest {
  paymentId: string;
  amount: number;
  currency: 'XOF' | 'XAF' | 'EUR' | 'USD';
  description: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, any>;
}

export interface PaymentInitiationResponse {
  success: boolean;
  paymentId: string;
  provider: PaymentProvider;
  checkoutUrl?: string;
  providerReference?: string;
  qrCodeUrl?: string;
  deepLink?: string;
  error?: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  paymentId: string;
  providerReference?: string;
  amountPaid: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  rawPayload: any;
  error?: string;
}

export interface PaymentGatewayAdapter {
  provider: PaymentProvider;
  initiatePayment(req: PaymentInitiationRequest): Promise<PaymentInitiationResponse>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerificationResult>;
}
