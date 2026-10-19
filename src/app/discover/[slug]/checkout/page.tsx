'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA, isEventClosedOrPast } from '@/lib/utils/format';
import { playSuccessBeep } from '@/lib/audio/sound-effects';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Footer } from '@/components/layout/Footer';
import { PaymentMethod, OrderItem } from '@/types';
import { CheckoutSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/security/rate-limit';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Phone,
  User,
  Mail,
  Zap,
  CreditCard,
  Smartphone,
  AlertCircle,
} from 'lucide-react';

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getEventBySlug, purchaseTickets } = useJeltixStore();
  const event = getEventBySlug(resolvedParams.slug);

  const [checkoutData, setCheckoutData] = useState<{
    eventId: string;
    items: OrderItem[];
    totalPrice: number;
  } | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PAYTECH');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('jeltix_checkout') || sessionStorage.getItem('foutaticket_checkout');
      if (stored) {
        try {
          setCheckoutData(JSON.parse(stored));
        } catch {
          // fallback handled below
        }
      }
      if (!stored && event) {
        const firstType = event.ticketTypes?.[0];
        const unitPrice = firstType?.price || 500;
        setCheckoutData({
          eventId: event.id,
          items: [
            {
              ticketTypeId: firstType?.id || `tt-${event.id}-0`,
              ticketTypeName: firstType?.name || 'Billet Standard',
              quantity: 1,
              unitPrice,
              subtotal: unitPrice,
            },
          ],
          totalPrice: unitPrice,
        });
      }
    }
  }, [event]);

  if (!event || !checkoutData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm font-bold text-on-surface">Chargement de la commande sécurisée Jël Tix...</p>
      </div>
    );
  }

  if (isEventClosedOrPast(event)) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <PublicHeader />
        <div className="flex-1 max-w-lg mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-500 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-black font-black text-xs uppercase font-mono tracking-wider mb-3">
            Billetterie Clôturée
          </span>
          <h1 className="text-2xl font-black text-on-surface mb-2">
            Cet événement est terminé
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
            La vente de billets en ligne pour <strong className="text-on-surface font-black">"{event.title}"</strong> est désormais fermée car l'événement est passé ou a été clôturé par son organisateur.
          </p>
          <Link
            href={`/discover/${event.slug}`}
            className="px-6 py-3 rounded-2xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-2 shadow-md hover:bg-primary-hover transition-transform active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retourner à la fiche de l'événement</span>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (isEventClosedOrPast(event)) {
      setValidationError("Cet événement est terminé. Les achats ne sont plus possibles.");
      return;
    }

    // 1. Rate Limiting Check (Max 5 attempts per minute per phone)
    const rateCheck = checkRateLimit(`checkout_${customerPhone.replace(/\s+/g, '')}`, 5, 60000);
    if (!rateCheck.success) {
      setValidationError(
        `Trop de tentatives de paiement. Veuillez patienter ${Math.ceil(rateCheck.resetMs / 1000)} secondes avant de réessayer.`
      );
      return;
    }

    // 2. Strict Zod Schema Validation
    const validation = CheckoutSchema.safeParse({
      customerName,
      customerPhone,
      customerEmail: customerEmail.trim() || undefined,
      paymentMethod,
      items: checkoutData.items.map((item) => ({
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
      })),
    });

    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message || 'Informations de paiement invalides';
      setValidationError(firstIssue);
      return;
    }

    setIsProcessing(true);

    try {
      // 3. Initiate payment via PayTech API
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventTitle: event.title,
          customerName: validation.data.customerName,
          customerPhone: validation.data.customerPhone,
          customerEmail: validation.data.customerEmail,
          paymentMethod,
          items: checkoutData.items,
          totalPrice: checkoutData.totalPrice,
          returnUrl: `${window.location.origin}/discover/${event.slug}/checkout/success`,
          cancelUrl: `${window.location.origin}/discover/${event.slug}?payment_cancelled=1`,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setValidationError(data.error || 'Erreur lors de l’initialisation auprès de PayTech');
        setIsProcessing(false);
        return;
      }

      // Si PayTech a retourné une URL de redirection (Wave, Orange Money, Free Money, Carte)
      if (data.redirect && data.checkoutUrl) {
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              'jeltix_pending_payment',
              JSON.stringify({
                eventId: event.id,
                orderRef: data.orderRef,
                paymentId: data.paymentId,
                customerName: validation.data.customerName,
                customerPhone: validation.data.customerPhone,
                customerEmail: validation.data.customerEmail,
                items: checkoutData.items,
                totalPrice: checkoutData.totalPrice,
                paymentMethod,
              })
            );
          } catch {}
        }
        window.location.href = data.checkoutUrl;
        return;
      }

      // Fallback local instantané (si clés PayTech non définies ou mode démo)
      const result = purchaseTickets({
        eventId: event.id,
        customerName: validation.data.customerName,
        customerPhone: validation.data.customerPhone,
        customerEmail: validation.data.customerEmail,
        items: checkoutData.items,
        paymentMethod,
        channel: 'ONLINE',
      });

      // Stocker les billets localement pour un accès fluide dans "Mes Billets"
      if (typeof window !== 'undefined') {
        try {
          const existingCodes = JSON.parse(localStorage.getItem('jeltix_my_tickets') || '[]');
          const newCodes = result.generatedTickets.map((t) => t.ticketCode);
          const merged = Array.from(new Set([...newCodes, ...existingCodes]));
          localStorage.setItem('jeltix_my_tickets', JSON.stringify(merged));
          localStorage.setItem('jeltix_customer_phone', validation.data.customerPhone);
          localStorage.setItem('jeltix_customer_name', validation.data.customerName);
        } catch {}
      }

      playSuccessBeep();
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#0038A8', '#4EED15', '#0D52D6', '#FFFFFF'],
      });

      setIsProcessing(false);

      const firstTicket = result.generatedTickets[0];
      router.push(`/tickets/${firstTicket.ticketCode}`);
    } catch (err) {
      console.warn('Fallback achat direct local:', err);
      const result = purchaseTickets({
        eventId: event.id,
        customerName: validation.data.customerName,
        customerPhone: validation.data.customerPhone,
        customerEmail: validation.data.customerEmail,
        items: checkoutData.items,
        paymentMethod,
        channel: 'ONLINE',
      });

      if (typeof window !== 'undefined') {
        try {
          const existingCodes = JSON.parse(localStorage.getItem('jeltix_my_tickets') || '[]');
          const newCodes = result.generatedTickets.map((t) => t.ticketCode);
          const merged = Array.from(new Set([...newCodes, ...existingCodes]));
          localStorage.setItem('jeltix_my_tickets', JSON.stringify(merged));
          localStorage.setItem('jeltix_customer_phone', validation.data.customerPhone);
          localStorage.setItem('jeltix_customer_name', validation.data.customerName);
        } catch {}
      }

      setIsProcessing(false);
      const firstTicket = result.generatedTickets[0];
      router.push(`/tickets/${firstTicket.ticketCode}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
        {/* Header Breadcrumb */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href={`/discover/${event.slug}`}
            className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-[#0038A8] tracking-widest font-mono bg-[#0038A8]/10 px-2 py-0.5 rounded">
                Tunnel Sécurisé Jël Tix
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-on-surface mt-0.5">
              Paiement & Émission de Billets
            </h1>
          </div>
        </div>

        <form onSubmit={handlePay} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Client Details & Payment Option */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {validationError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Step 1: Client Coordinates */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/30 shadow-xs space-y-4">
              <h2 className="text-base font-black text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-3">
                <span className="w-7 h-7 rounded-lg bg-[#0038A8]/10 text-[#0038A8] flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <span>Coordonnées du Spectateur</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Nom & Prénom *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Babacar Ndiaye"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-outline-variant/30 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      Numéro WhatsApp / Téléphone *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+221 77 123 45 67"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-outline-variant/30 text-xs font-mono font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                      <span>✓ Votre e-billet avec QR code sera expédié sur ce numéro WhatsApp</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">
                      Email (pour recevoir le billet)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="nom@exemple.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Payment Provider */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/30 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <h2 className="text-base font-black text-on-surface flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#0038A8]/10 text-[#0038A8] flex items-center justify-center font-bold text-xs">
                    2
                  </span>
                  <span>Passerelle de Paiement Sécurisée</span>
                </h2>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1 rounded-full flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3" />
                  <span>PayTech SN</span>
                </span>
              </div>

              {/* PayTech Unified Container */}
              <div className="p-5 rounded-2xl bg-surface border-2 border-primary/20 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#0038A8]/10 text-[#0038A8] flex items-center justify-center shrink-0">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-on-surface">
                      Choix du moyen de paiement sur PayTech
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                      En cliquant sur <strong className="text-on-surface">Payer</strong>, vous serez automatiquement redirigé vers l'interface officielle PayTech pour choisir votre mode de règlement :
                    </p>
                  </div>
                </div>

                {/* Operator Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-[#1DC9FE]/40 flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1DC9FE]" />
                    <span className="text-xs font-black text-on-surface font-mono">Wave</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-[#FF7900]/40 flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF7900]" />
                    <span className="text-xs font-black text-on-surface font-mono">Orange Money</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-[#E60000]/40 flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E60000]" />
                    <span className="text-xs font-black text-on-surface font-mono">Free Money</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-primary/40 flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-xs font-black text-on-surface font-mono">Carte Visa / MC</span>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  Passerelle certifiée PCI-DSS PayTech Sénégal
                </span>
                <span className="font-mono text-[10px] text-on-surface-variant/70">
                  Devise : FCFA (XOF)
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Confirmation Button */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-surface-container-low rounded-3xl p-6 sm:p-8 border border-outline-variant/30 shadow-xl space-y-5">
              <h3 className="text-base font-black text-on-surface border-b border-outline-variant/20 pb-3">
                Récapitulatif de Réservation
              </h3>

              <div className="space-y-2">
                <p className="font-extrabold text-sm text-on-surface">{event.title}</p>
                <p className="text-xs text-on-surface-variant font-mono">
                  {event.venue} • {event.timeString}
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-outline-variant/20">
                {checkoutData.items.map((item) => (
                  <div key={item.ticketTypeId} className="flex justify-between text-xs">
                    <span className="font-medium text-on-surface">
                      {item.quantity}x {item.ticketTypeName}
                    </span>
                    <span className="font-mono font-bold text-on-surface">
                      {formatFCFA(item.subtotal)} FCFA
                    </span>
                  </div>
                ))}

                <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-baseline">
                  <span className="text-xs font-bold uppercase text-on-surface-variant font-mono">
                    Total Final
                  </span>
                  <span className="text-2xl font-black text-primary font-mono">
                    {formatFCFA(checkoutData.totalPrice)} FCFA
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#2CA808] to-[#4EED15] hover:opacity-95 text-[#002D8C] font-black text-sm uppercase tracking-wider shadow-xl shadow-[#4EED15]/25 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#002D8C] border-t-transparent rounded-full animate-spin" />
                    <span>Redirection vers PayTech...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Payer {formatFCFA(checkoutData.totalPrice)} FCFA sur PayTech</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-[10px] text-on-surface-variant flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2CA808]" />
                  <span>Transaction cryptée & QR Code officiel délivré aussitôt</span>
                </p>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
