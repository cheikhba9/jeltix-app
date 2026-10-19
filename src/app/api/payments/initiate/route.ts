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
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    let origin = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).trim();
    if (origin.endsWith('/')) {
      origin = origin.slice(0, -1);
    }

    // Guichet PayTech multi-opérateurs : le client choisit Wave, OM, Free ou Carte directement sur PayTech
    const provider: PaymentProvider = 'PAYTECH';

    let successReturnUrl = returnUrl
      ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}ref=${orderRef}&payment=success`
      : `${origin}/tickets?ref=${orderRef}&payment=success`;
    let failureCancelUrl = cancelUrl
      ? `${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}ref=${orderRef}&cancelled=1`
      : `${origin}/discover?cancelled=1`;

    // Éliminer toute double barre oblique dans le chemin pour respecter la validation PayTech
    successReturnUrl = successReturnUrl.replace(/([^:]\/)\/+/g, '$1');
    failureCancelUrl = failureCancelUrl.replace(/([^:]\/)\/+/g, '$1');

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
