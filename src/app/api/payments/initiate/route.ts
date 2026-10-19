import { NextResponse } from 'next/server';
import { paymentGateway } from '@/lib/services/payments';
import { generateOrderReference } from '@/lib/utils/format';
import { PaymentProvider } from '@/lib/services/payments/payment.types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      eventId,
      eventTitle,
      customerName,
      customerPhone,
      customerEmail,
      paymentMethod,
      items,
      totalPrice,
      returnUrl,
      cancelUrl,
    } = body;

    if (!eventId || !customerName || !customerPhone || !items || items.length === 0 || !totalPrice) {
      return NextResponse.json(
        { success: false, error: 'Champs obligatoires manquants pour initialiser le paiement' },
        { status: 400 }
      );
    }

    const orderRef = generateOrderReference();
    const paymentId = `PAY-${orderRef}`;

    // Base URL pour les redirections
    let origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://jeltix-sn.vercel.app').trim().replace(/\/+$/, '');
    if (!origin || origin.includes('localhost') || origin.startsWith('http://')) {
      origin = 'https://jeltix-sn.vercel.app';
    }

    // Guichet PayTech multi-opérateurs : le client choisit Wave, OM, Free ou Carte directement sur PayTech
    const provider: PaymentProvider = 'PAYTECH';

    // Remplacer localhost dans returnUrl et cancelUrl si nécessaire
    const formatUrl = (rawUrl?: string, fallbackPath = '/tickets') => {
      let target = rawUrl?.trim() || `${origin}${fallbackPath}`;
      try {
        if (target.startsWith('/')) {
          target = `${origin}${target}`;
        }
        const u = new URL(target);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.protocol === 'http:') {
          const originU = new URL(origin);
          u.protocol = 'https:';
          u.host = originU.host;
          u.port = '';
        }
        return u.toString().replace(/([^:]\/)\/+/g, '$1');
      } catch {
        return `${origin}${fallbackPath}`;
      }
    };

    let successReturnUrl = formatUrl(
      returnUrl ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}ref=${orderRef}&payment=success` : undefined,
      `/tickets?ref=${orderRef}&payment=success`
    );
    let failureCancelUrl = formatUrl(
      cancelUrl ? `${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}ref=${orderRef}&cancelled=1` : undefined,
      `/discover?cancelled=1`
    );

    // Appel au gestionnaire de passerelle
    const initiationResult = await paymentGateway.initiateCheckout(provider, {
      paymentId,
      amount: Math.round(totalPrice),
      currency: 'XOF',
      description: `Billets pour ${eventTitle || 'Événement'} (${items.length} catégorie(s))`,
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      returnUrl: successReturnUrl,
      cancelUrl: failureCancelUrl,
      metadata: {
        orderRef,
        eventId,
        eventTitle,
        customerName,
        customerPhone,
        customerEmail,
        items,
        totalPrice,
        paymentMethod: paymentMethod || 'PAYTECH',
      },
    });

    if (!initiationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: initiationResult.error || 'Erreur lors de l’initialisation auprès de PayTech',
        },
        { status: 400 }
      );
    }

    // Si une URL de paiement PayTech hébergée est disponible
    if (initiationResult.checkoutUrl) {
      return NextResponse.json({
        success: true,
        redirect: true,
        checkoutUrl: initiationResult.checkoutUrl,
        paymentId,
        orderRef,
        provider: initiationResult.provider,
        providerReference: initiationResult.providerReference,
      });
    }

    // Mode direct / fallback sans redirection externe
    return NextResponse.json({
      success: true,
      redirect: false,
      paymentId,
      orderRef,
      provider: initiationResult.provider,
    });
  } catch (err: any) {
    console.error('Erreur API /payments/initiate:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Erreur serveur interne' },
      { status: 500 }
    );
  }
}
