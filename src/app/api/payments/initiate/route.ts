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
      cancelUrl ? `${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}ref=${orderRef}&cancelled=1&payment_failed=1` : undefined,
      `/discover?cancelled=1&payment_failed=1`
    );

    // Vérification et recalcul strict du montant officiel à partir des prix fixés sur l'événement en base
    let calculatedAmount = 0;
    let finalEventTitle = eventTitle || 'Événement';
    let validatedItems = items;

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const supabase = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
        let query = supabase.from('events').select('id, title, status, ticket_types(*)');
        if (isUuid) {
          query = query.eq('id', eventId);
        } else {
          query = query.eq('slug', eventId);
        }
        const { data: eventData } = await query.maybeSingle();

        if (eventData) {
          finalEventTitle = eventData.title || finalEventTitle;
          const officialTicketTypes: any[] = eventData.ticket_types || [];

          if (officialTicketTypes.length > 0 && Array.isArray(items)) {
            let sum = 0;
            validatedItems = items.map((it: any) => {
              const matched = officialTicketTypes.find(
                (tt: any) =>
                  tt.id === it.ticketTypeId ||
                  (tt.name && it.ticketTypeName && tt.name.trim().toLowerCase() === it.ticketTypeName.trim().toLowerCase())
              ) || officialTicketTypes[0];

              const unitPrice = Number(matched.price) || 0;
              const quantity = Math.max(1, Number(it.quantity) || 1);
              const subtotal = unitPrice * quantity;
              sum += subtotal;

              return {
                ...it,
                ticketTypeId: matched.id,
                ticketTypeName: matched.name,
                unitPrice,
                subtotal,
              };
            });

            if (sum > 0) {
              calculatedAmount = sum;
            }
          }
        }
      } catch (dbErr) {
        console.warn('Vérification Supabase des tarifs:', dbErr);
      }
    }

    const finalAmount = calculatedAmount > 0 ? calculatedAmount : Math.round(Number(totalPrice) || 0);

    // Appel au gestionnaire de passerelle avec le montant officiel certifié
    const initiationResult = await paymentGateway.initiateCheckout(provider, {
      paymentId,
      amount: finalAmount,
      currency: 'XOF',
      description: `Billets pour ${finalEventTitle} (${validatedItems.length} catégorie(s))`,
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      returnUrl: successReturnUrl,
      cancelUrl: failureCancelUrl,
      metadata: {
        orderRef,
        eventId,
        eventTitle: finalEventTitle,
        customerName,
        customerPhone,
        customerEmail,
        items: validatedItems,
        totalPrice: finalAmount,
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

    // Si une URL de paiement PayTech hébergée est disponible, pré-remplir automatiquement le nom et téléphone
    if (initiationResult.checkoutUrl) {
      let finalCheckoutUrl = initiationResult.checkoutUrl;
      const cleanDigits = customerPhone.replace(/\D/g, '');
      const national = cleanDigits.startsWith('221') ? cleanDigits.slice(3) : cleanDigits;
      const intl = `+221${national}`;

      const sep = finalCheckoutUrl.includes('?') ? '&' : '?';
      finalCheckoutUrl = `${finalCheckoutUrl}${sep}fn=${encodeURIComponent(customerName)}&pn=${encodeURIComponent(intl)}&nn=${encodeURIComponent(national)}`;

      return NextResponse.json({
        success: true,
        redirect: true,
        checkoutUrl: finalCheckoutUrl,
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
