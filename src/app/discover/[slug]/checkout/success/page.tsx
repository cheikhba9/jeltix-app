'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Footer } from '@/components/layout/Footer';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA } from '@/lib/utils/format';
import { playSuccessBeep } from '@/lib/audio/sound-effects';
import confetti from 'canvas-confetti';
import dynamic from 'next/dynamic';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Ticket as TicketIcon,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), {
  loading: () => <div className="w-10 h-10 bg-slate-100 dark:bg-white/10 rounded-lg animate-pulse" />,
  ssr: false,
});

export default function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const refParam = searchParams.get('ref') || searchParams.get('orderRef');
  const tokenParam = searchParams.get('token');

  const { getEventBySlug, tickets: storeTickets, orders: storeOrders } = useJeltixStore();
  const event = getEventBySlug(resolvedParams.slug);

  const [status, setStatus] = useState<'loading' | 'completed' | 'pending' | 'failed'>('loading');
  const [orderData, setOrderData] = useState<any>(null);
  const [issuedTickets, setIssuedTickets] = useState<any[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let pollTimeout: NodeJS.Timeout;

    async function checkPaymentStatus() {
      try {
        const isSuccessParam = searchParams.get('payment') === 'success';
        const pendingRaw = typeof window !== 'undefined' ? sessionStorage.getItem('jeltix_pending_payment') : null;
        let pendingData = null;
        if (pendingRaw) {
          try {
            pendingData = JSON.parse(pendingRaw);
          } catch {}
        }

        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref: refParam,
            token: tokenParam,
            isSuccess: isSuccessParam,
            eventSlug: resolvedParams.slug,
            pendingPayment: pendingData,
          }),
        });
        const data = await res.json();

        if (!isMounted) return;

        const isCompleted =
          data.status === 'completed' ||
          (data.order && (data.order.paymentStatus === 'COMPLETED' || data.order.payment_status === 'COMPLETED'));

        if (isCompleted) {
          setStatus('completed');
          setOrderData(data.order);
          const tList = data.tickets || [];
          setIssuedTickets(tList);

          // Sauvegarder dans localStorage pour "Mes Billets" et nettoyer les caches de commande
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.removeItem('jeltix_pending_payment');
              sessionStorage.removeItem('jeltix_checkout');
              const existingCodes = JSON.parse(localStorage.getItem('jeltix_my_tickets') || '[]');
              const newCodes = tList.map((t: any) => t.ticketCode);
              const merged = Array.from(new Set([...newCodes, ...existingCodes]));
              localStorage.setItem('jeltix_my_tickets', JSON.stringify(merged));
              if (data.order?.customerPhone) {
                localStorage.setItem('jeltix_customer_phone', data.order.customerPhone);
              }
              if (data.order?.customerName) {
                localStorage.setItem('jeltix_customer_name', data.order.customerName);
              }
            } catch {}
          }

          playSuccessBeep();
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#0038A8', '#4EED15', '#0D52D6', '#FF7900', '#FFFFFF'],
          });
          return;
        }

        // Si la commande existe dans le store local
        if (refParam) {
          const matchOrder = storeOrders.find(
            (o) => o.reference === refParam || o.id === refParam
          );
          if (matchOrder) {
            const matchTickets = storeTickets.filter((t) => t.orderId === matchOrder.id);
            setStatus('completed');
            setOrderData(matchOrder);
            setIssuedTickets(matchTickets);
            return;
          }
        }

        // Continuer le polling si pending
        if (retryCount < 8) {
          setStatus('pending');
          pollTimeout = setTimeout(() => {
            if (isMounted) setRetryCount((prev) => prev + 1);
          }, 3000);
        } else {
          setStatus('pending');
        }
      } catch (err) {
        console.error('Erreur vérification paiement:', err);
        if (retryCount < 5) {
          pollTimeout = setTimeout(() => {
            if (isMounted) setRetryCount((prev) => prev + 1);
          }, 3000);
        } else {
          setStatus('failed');
        }
      }
    }

    checkPaymentStatus();

    return () => {
      isMounted = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [refParam, tokenParam, retryCount, storeOrders, storeTickets]);

  const primaryTicketCode = issuedTickets[0]?.ticketCode;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center">
        {status === 'loading' && (
          <div className="bg-surface-container-lowest rounded-3xl p-8 sm:p-12 border border-outline-variant/30 text-center shadow-lg space-y-4 max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 className="text-xl font-black text-on-surface">Vérification de la transaction...</h1>
            <p className="text-xs text-on-surface-variant">
              Nous vérifions la confirmation de votre paiement auprès de PayTech & de votre opérateur mobile.
            </p>
          </div>
        )}

        {status === 'pending' && (
          <div className="bg-surface-container-lowest rounded-3xl p-8 sm:p-10 border border-outline-variant/30 text-center shadow-lg space-y-5 max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black text-on-surface">Paiement en cours de validation</h1>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                Si vous avez validé la transaction sur votre téléphone (Wave, Orange Money ou Free), votre billet est en train d'être généré.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => setRetryCount((prev) => prev + 1)}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-xs uppercase tracking-wider cursor-pointer hover:bg-primary-hover active:scale-95 transition-transform"
              >
                Actualiser la vérification
              </button>
              <Link
                href="/tickets"
                className="w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold text-center transition-colors"
              >
                Vérifier dans "Mes Billets"
              </Link>
            </div>
          </div>
        )}

        {status === 'completed' && (
          <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Header Success Card */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/30 shadow-xl text-center space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-gradient-to-br from-[#4EED15]/20 to-transparent rounded-full blur-2xl pointer-events-none" />

              <div className="w-20 h-20 rounded-full bg-[#2CA808]/15 text-[#2CA808] mx-auto flex items-center justify-center shadow-lg shadow-[#2CA808]/20">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2CA808]/10 text-[#2CA808] text-xs font-bold uppercase tracking-wider font-mono">
                  <Sparkles className="w-3.5 h-3.5" /> Paiement Confirmé avec Succès
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-on-surface mt-2">
                  Vos E-Billets sont Disponibles !
                </h1>
                <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto mt-1">
                  Merci pour votre achat. Vos billets avec QR code officiel ont été générés et enregistrés sur votre appareil.
                </p>
              </div>

              {/* Order quick metadata */}
              <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/20 grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase font-mono block">Référence</span>
                  <span className="text-xs font-mono font-bold text-on-surface">
                    {orderData?.reference || refParam || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase font-mono block">Client</span>
                  <span className="text-xs font-bold text-on-surface truncate block">
                    {orderData?.customerName || 'Spectateur'}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-on-surface-variant uppercase font-mono block">Mode</span>
                  <span className="text-xs font-bold text-[#0038A8] dark:text-[#1DC9FE] font-mono">
                    {orderData?.paymentMethod || 'Mobile Money PayTech'}
                  </span>
                </div>
              </div>

              {/* Action primary button */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                {primaryTicketCode ? (
                  <Link
                    href={`/tickets/${primaryTicketCode}`}
                    className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#2CA808] to-[#4EED15] hover:opacity-95 text-[#002D8C] font-black text-sm uppercase tracking-wider shadow-xl shadow-[#4EED15]/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <TicketIcon className="w-5 h-5" />
                    <span>Afficher mon E-Billet</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                ) : (
                  <Link
                    href="/tickets"
                    className="flex-1 py-4 px-6 rounded-2xl bg-primary text-on-primary font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <TicketIcon className="w-5 h-5" />
                    <span>Accéder à "Mes Billets"</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                )}

                <Link
                  href="/tickets"
                  className="py-4 px-6 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Tous mes billets</span>
                </Link>
              </div>
            </div>

            {/* Issued tickets list preview */}
            {issuedTickets.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-on-surface uppercase tracking-wider font-mono">
                  Billets Émis ({issuedTickets.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {issuedTickets.map((t: any) => (
                    <Link
                      key={t.id || t.ticketCode}
                      href={`/tickets/${t.ticketCode}`}
                      className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/50 transition-all flex items-center justify-between group shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-surface-container group-hover:bg-primary/10 transition-colors">
                          <QRCodeSVG value={t.ticketCode} size={42} />
                        </div>
                        <div>
                          <p className="text-xs font-mono font-bold text-primary">
                            #{t.ticketCode}
                          </p>
                          <p className="text-[11px] font-bold text-on-surface">
                            {t.ticketTypeName || 'Billet Standard'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-mono">
                            {formatFCFA(t.price || 0)} FCFA
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-surface-container-lowest rounded-3xl p-8 sm:p-10 border border-outline-variant/30 text-center shadow-lg space-y-4 max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-on-surface">Impossible de confirmer la commande</h1>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Le paiement n'a pas pu être validé automatiquement. Si vous avez bien été débité, ne vous inquiétez pas : munissez-vous de votre numéro de téléphone et vérifiez l'espace "Mes Billets".
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/tickets"
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-xs uppercase tracking-wider text-center"
              >
                Rechercher avec mon Téléphone
              </Link>
              <Link
                href={`/discover/${resolvedParams.slug}`}
                className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface text-xs font-semibold text-center"
              >
                Retourner à l'événement
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
