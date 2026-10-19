import crypto from 'node:crypto';
import type {
  PaymentGatewayAdapter,
  PaymentInitiationRequest,
  PaymentInitiationResponse,
  WebhookVerificationResult,
} from './payment.types';

export interface PaytechConfig {
  apiKey: string;
  apiSecret: string;
  env?: 'test' | 'prod';
  ipnUrl?: string;
}

export type PaytechOperator =
  | 'Orange Money'
  | 'Wave'
  | 'Free Money'
  | 'Carte Bancaire'
  | string;

export interface PaytechIPNPayload {
  type_event?: 'sale_complete' | 'sale_canceled' | 'refund_complete' | string;
  ref_command?: string;
  item_name?: string;
  item_price?: string | number;
  currency?: string;
  command_name?: string;
  token?: string;
  env?: string;
  payment_method?: string;
  client_phone?: string;
  custom_field?: string;
  api_key_sha256?: string;
  api_secret_sha256?: string;
  hmac_compute?: string;
  [key: string]: any;
}

const PAYTECH_API_URL = 'https://paytech.sn/api';
const FETCH_TIMEOUT_MS = 15_000;

export class PaytechAdapter implements PaymentGatewayAdapter {
  readonly provider = 'PAYTECH' as const;
  private config: PaytechConfig;

  constructor(config: PaytechConfig) {
    this.config = {
      apiKey: config.apiKey?.trim(),
      apiSecret: config.apiSecret?.trim(),
      env: config.env || (process.env.NODE_ENV === 'production' ? 'prod' : 'test'),
      ipnUrl: config.ipnUrl,
    };
  }

  /**
   * Initialise une demande de paiement hébergée sur PayTech
   * Prend en charge Wave, Orange Money, Free Money et Carte Bancaire.
   */
  async initiatePayment(req: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const env = this.config.env ?? (process.env.NODE_ENV === 'production' ? 'prod' : 'test');

    // Résolution de l'URL IPN publique
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://jeltix.sn');
    const ipnUrl = this.config.ipnUrl || `${baseUrl}/api/webhooks/paytech`;

    // Métadonnées personnalisées stockées dans custom_field
    const customData = {
      paymentId: req.paymentId,
      customerName: req.customerName,
      customerPhone: req.customerPhone,
      customerEmail: req.customerEmail,
      ...(req.metadata || {}),
    };

    const body: Record<string, any> = {
      item_name: req.metadata?.eventName || req.description || 'Billet Jël Tix',
      item_price: Math.round(req.amount), // Entier en XOF
      currency: 'XOF',
      ref_command: req.paymentId,
      command_name: req.description.slice(0, 200),
      env,
      ipn_url: ipnUrl,
      success_url: req.returnUrl,
      cancel_url: req.cancelUrl,
      custom_field: JSON.stringify(customData),
    };

    // Ciblage optionnel de l'opérateur (ex: Wave, Orange Money, etc.)
    if (req.metadata?.targetPayment) {
      body.target_payment = req.metadata.targetPayment;
    }

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(`${PAYTECH_API_URL}/payment/request-payment`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          API_KEY: this.config.apiKey,
          API_SECRET: this.config.apiSecret,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.success !== 1 || !data.token) {
        return {
          success: false,
          paymentId: req.paymentId,
          provider: this.provider,
          error: data?.message || `Erreur PayTech HTTP ${res.status}`,
        };
      }

      const checkoutUrl = data.redirect_url || data.redirectUrl;
      if (!checkoutUrl) {
        return {
          success: false,
          paymentId: req.paymentId,
          provider: this.provider,
          error: "Réponse PayTech valide mais absence d'URL de redirection",
        };
      }

      return {
        success: true,
        paymentId: req.paymentId,
        provider: this.provider,
        checkoutUrl,
        providerReference: data.token,
      };
    } catch (err: any) {
      return {
        success: false,
        paymentId: req.paymentId,
        provider: this.provider,
        error: err.message || 'Impossible de joindre les serveurs PayTech',
      };
    }
  }

  /**
   * Vérifie la signature de la notification IPN PayTech (HMAC-SHA256 ou SHA256-of-keys)
   * et renvoie le statut normalisé du paiement.
   */
  async verifyWebhook(
    rawBody: string,
    headers: Record<string, string>,
    parsedBody?: Record<string, any>
  ): Promise<WebhookVerificationResult> {
    try {
      let payload: PaytechIPNPayload = parsedBody || {};

      if (!parsedBody) {
        const contentType = headers['content-type'] || headers['Content-Type'] || '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(rawBody);
          payload = Object.fromEntries(params.entries());
        } else {
          payload = JSON.parse(rawBody);
        }
      }

      const isSignatureValid = this.checkSignature(payload);

      if (!isSignatureValid) {
        return {
          isValid: false,
          paymentId: payload.ref_command || '',
          providerReference: payload.token,
          amountPaid: Number(payload.item_price || 0),
          status: 'FAILED',
          rawPayload: payload,
          error: 'Signature IPN PayTech invalide',
        };
      }

      // Décoder custom_field si présent (peut être JSON brut ou encodé Base64)
      const customField = this.decodeCustomField(payload.custom_field);
      const paymentId = payload.ref_command || customField?.paymentId || '';
      const amountPaid = typeof payload.item_price === 'number'
        ? payload.item_price
        : parseInt(String(payload.item_price || '0'), 10);

      const isSuccess = payload.type_event === 'sale_complete';
      const isCanceled = payload.type_event === 'sale_canceled';

      return {
        isValid: true,
        paymentId,
        providerReference: payload.token,
        amountPaid,
        status: isSuccess ? 'SUCCESS' : isCanceled ? 'FAILED' : 'PENDING',
        rawPayload: {
          ...payload,
          decodedCustomField: customField,
        },
      };
    } catch (err: any) {
      return {
        isValid: false,
        paymentId: '',
        amountPaid: 0,
        status: 'FAILED',
        rawPayload: null,
        error: err.message || 'Erreur lors du traitement du webhook PayTech',
      };
    }
  }

  /**
   * Vérifie la signature avec HMAC-SHA256 (prioritaire) ou double SHA-256 des clés
   */
  private checkSignature(payload: PaytechIPNPayload): boolean {
    // Méthode 1: HMAC-SHA256 si activé sur le dashboard
    if (payload.hmac_compute) {
      const message = `${payload.item_price}|${payload.ref_command}|${this.config.apiKey}`;
      const expected = crypto
        .createHmac('sha256', this.config.apiSecret)
        .update(message)
        .digest('hex');

      const a = Buffer.from(payload.hmac_compute);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true;
      }
    }

    // Méthode 2: SHA256 des clés API (Standard PayTech)
    if (payload.api_key_sha256 && payload.api_secret_sha256) {
      const expectedKeyHash = crypto
        .createHash('sha256')
        .update(this.config.apiKey)
        .digest('hex');
      const expectedSecretHash = crypto
        .createHash('sha256')
        .update(this.config.apiSecret)
        .digest('hex');

      const aK = Buffer.from(payload.api_key_sha256);
      const bK = Buffer.from(expectedKeyHash);
      const aS = Buffer.from(payload.api_secret_sha256);
      const bS = Buffer.from(expectedSecretHash);

      const keyOk = aK.length === bK.length && crypto.timingSafeEqual(aK, bK);
      const secretOk = aS.length === bS.length && crypto.timingSafeEqual(aS, bS);

      if (keyOk && secretOk) return true;
    }

    return false;
  }

  /**
   * Décode le champ custom_field de PayTech (JSON ou base64)
   */
  private decodeCustomField(raw?: string): Record<string, any> | null {
    if (!raw) return null;
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (typeof parsed === 'object') return parsed;
    } catch {}
    try {
      return JSON.parse(raw);
    } catch {}
    return null;
  }

  /**
   * Vérification du statut en interrogeant directement l'API PayTech
   */
  async verifyPayment(token: string): Promise<{
    status: 'completed' | 'pending' | 'failed' | 'cancelled' | string;
    raw: any;
  } | null> {
    try {
      const res = await fetch(
        `${PAYTECH_API_URL}/payment/get-status?token_payment=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            API_KEY: this.config.apiKey,
            API_SECRET: this.config.apiSecret,
          },
        }
      );

      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      if (!json) return null;

      const raw = json.status || json.payment_status || json.data?.status || 'unknown';
      const lc = String(raw).toLowerCase();
      const status =
        lc.includes('complete') || lc.includes('success')
          ? 'completed'
          : lc.includes('cancel')
          ? 'cancelled'
          : lc.includes('fail')
          ? 'failed'
          : 'pending';

      return { status, raw: json };
    } catch {
      return null;
    }
  }
}
