'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA, formatDateFrench, formatDateWithDay } from '@/lib/utils/format';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Footer } from '@/components/layout/Footer';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Plus,
  Minus,
  Sparkles,
  Share2,
  Ticket as TicketIcon,
} from 'lucide-react';

export default function PublicEventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getEventBySlug, events } = useJeltixStore();
  const event = getEventBySlug(resolvedParams.slug);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [copiedLink, setCopiedLink] = useState(false);

  if (!event) {
    if (events.length === 0) {
      return (
        <div className="min-h-screen flex flex-col bg-background text-on-surface">
          <PublicHeader />
          <div className="flex-1 max-w-[1440px] mx-auto px-4 sm:px-6 py-12 w-full animate-pulse space-y-6">
            <div className="h-6 bg-slate-200 dark:bg-white/10 rounded-lg w-40" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-4">
                <div className="h-72 sm:h-96 bg-slate-200 dark:bg-white/10 rounded-3xl" />
                <div className="h-10 bg-slate-200 dark:bg-white/10 rounded-xl w-3/4" />
                <div className="h-20 bg-slate-200 dark:bg-white/10 rounded-2xl" />
              </div>
              <div className="lg:col-span-4">
                <div className="h-96 bg-slate-200 dark:bg-white/10 rounded-3xl" />
              </div>
            </div>
          </div>
          <Footer />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        <h1 className="text-2xl font-bold mb-2 text-on-surface">Événement introuvable</h1>
        <Link href="/" className="text-primary hover:underline text-sm font-bold">
          Retour à l'accueil Jël Tix
        </Link>
      </div>
    );
  }

  const handleQtyChange = (ticketTypeId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[ticketTypeId] || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      return { ...prev, [ticketTypeId]: next };
    });
  };

  const selectedItems = event.ticketTypes
    .map((tt) => ({
      ticketType: tt,
      quantity: quantities[tt.id] || 0,
      subtotal: (quantities[tt.id] || 0) * tt.price,
    }))
    .filter((item) => item.quantity > 0);

  const totalPrice = selectedItems.reduce((sum, it) => sum + it.subtotal, 0);
  const totalQuantity = selectedItems.reduce((sum, it) => sum + it.quantity, 0);
  const hasItems = selectedItems.length > 0;

  const handleProceedToCheckout = () => {
    if (!hasItems) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'jeltix_checkout',
        JSON.stringify({
          eventId: event.id,
          items: selectedItems.map((it) => ({
            ticketTypeId: it.ticketType.id,
            ticketTypeName: it.ticketType.name,
            quantity: it.quantity,
            unitPrice: it.ticketType.price,
            subtotal: it.subtotal,
          })),
          totalPrice,
        })
      );
    }
    router.push(`/discover/${event.slug}/checkout`);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: `${event.title} - Billetterie Jël Tix`,
          text: `Réservez vos places officielles pour ${event.title} sur Jël Tix`,
          url: shareUrl,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader />

      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 md:p-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-[#0038A8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tous les événements Jël Tix</span>
          </Link>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface transition-colors cursor-pointer border border-outline-variant/30"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Lien copié !' : 'Partager l’événement'}</span>
          </button>
        </div>

        <div className="flex flex-col w-full gap-8">
          {/* Cinematic Stadium Hero */}
          <div
            className="w-full relative rounded-3xl overflow-hidden shadow-xl min-h-[360px] md:min-h-[440px] bg-cover bg-center flex items-end"
            style={{
              backgroundImage: `url('${event.bannerImage}')`,
            }}
          >
            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050D1E] via-[#050D1E]/60 to-transparent" />
            <div className="absolute inset-0 bg-black/25" />

            <div className="relative z-10 p-6 sm:p-10 flex flex-col md:flex-row gap-6 md:items-end justify-between w-full">
              <div className="flex flex-col gap-3 max-w-3xl">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-3.5 py-1 bg-[#0038A8] text-white rounded-full font-black text-xs shadow-md">
                    {event.category}
                  </span>
                  <span className="inline-flex items-center px-3.5 py-1 bg-[#4EED15] text-[#002D8C] rounded-full font-black text-xs shadow-md">
                    ⚡ Billetterie Officielle Ouverte
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
                  {event.title}
                </h1>

                <div className="flex flex-wrap gap-4 text-xs sm:text-sm font-semibold text-white/90 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#4EED15]" />
                    <span>{formatDateWithDay(event.startDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#4EED15]" />
                    <span>{event.timeString}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#4EED15]" />
                    <span>{event.venue} ({event.locationDetails})</span>
                  </div>
                </div>
              </div>

              {/* Verified Organizer Pill */}
              <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-white shrink-0">
                <p className="text-[10px] font-mono text-white/70 uppercase">Organisateur Certifié</p>
                <p className="text-xs font-black text-[#4EED15] mt-0.5">{event.organizerName}</p>
              </div>
            </div>
          </div>

          {/* Main Grid: Ticket Categories & Booking Cart Sticky */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Ticket Types and Event Details */}
            <div className="lg:col-span-8 space-y-8">
              {/* Ticket Selection Area */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-black text-on-surface flex items-center gap-2">
                    <TicketIcon className="w-5 h-5 text-primary" />
                    <span>Sélectionnez vos Billets</span>
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Choisissez votre zone de stade ou espace réservé. Maximum 10 billets par commande.
                  </p>
                </div>

                <div className="space-y-4">
                  {event.ticketTypes.map((tt) => {
                    const qty = quantities[tt.id] || 0;
                    const isSoldOut = tt.soldQuantity >= tt.totalQuantity;

                    return (
                      <div
                        key={tt.id}
                        className={`bg-surface-container rounded-3xl p-6 border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                          qty > 0
                            ? 'border-primary shadow-md bg-[#0038A8]/5 dark:bg-[#0038A8]/20'
                            : 'border-outline-variant/30 hover:border-primary/50'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-surface text-primary px-2.5 py-0.5 rounded-full border border-outline-variant/30 font-mono">
                              {tt.badge || 'Accès Standard'}
                            </span>
                            {isSoldOut && (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-error-container text-error px-2.5 py-0.5 rounded-full">
                                Épuisé
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-black text-on-surface">{tt.name}</h3>
                          <p className="text-xs text-on-surface-variant leading-relaxed">{tt.description}</p>
                          <p className="text-xl font-black text-primary font-mono pt-1">
                            {formatFCFA(tt.price)}{' '}
                            <span className="text-xs font-normal text-on-surface-variant">FCFA / place</span>
                          </p>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center gap-2 bg-surface rounded-2xl p-1.5 border border-outline-variant/30 shadow-xs shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                          <button
                            type="button"
                            disabled={qty === 0 || isSoldOut}
                            onClick={() => handleQtyChange(tt.id, -1)}
                            className="w-10 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface font-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <span className="w-10 text-center font-black text-base text-on-surface font-mono">
                            {qty}
                          </span>

                          <button
                            type="button"
                            disabled={qty >= 10 || isSoldOut}
                            onClick={() => handleQtyChange(tt.id, 1)}
                            className="w-10 h-10 rounded-xl bg-primary text-on-primary hover:bg-primary-hover flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Event Description & Guidelines */}
              <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 border border-outline-variant/30 space-y-4">
                <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  <span>À Propos de l'Événement & Consignes de Sécurité</span>
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>

                {event.importantInfo && event.importantInfo.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-outline-variant/20">
                    <p className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono">
                      Informations Pratiques :
                    </p>
                    <ul className="space-y-1.5 text-xs text-on-surface-variant">
                      {event.importantInfo.map((info, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#2CA808] dark:text-[#4EED15] shrink-0 mt-0.5" />
                          <span>{info}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Right Sticky Checkout Summary */}
            <div className="lg:col-span-4 sticky top-24 space-y-4">
              <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/30 shadow-xl space-y-5">
                <div className="border-b border-outline-variant/20 pb-3">
                  <h3 className="text-lg font-black text-on-surface">Récapitulatif de Commande</h3>
                  <p className="text-xs text-on-surface-variant font-mono">
                    {totalQuantity} billet(s) sélectionné(s)
                  </p>
                </div>

                {selectedItems.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant text-xs space-y-2">
                    <p className="font-semibold">Votre sélection est vide.</p>
                    <p className="text-[11px]">Ajoutez au moins un billet pour continuer vers le paiement Wave / Orange Money.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedItems.map((it) => (
                      <div key={it.ticketType.id} className="flex justify-between text-xs font-medium">
                        <span className="text-on-surface">
                          {it.quantity}x {it.ticketType.name}
                        </span>
                        <span className="font-bold font-mono text-on-surface">
                          {formatFCFA(it.subtotal)} FCFA
                        </span>
                      </div>
                    ))}

                    <div className="pt-3 border-t border-outline-variant/20 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-on-surface-variant uppercase font-mono">Total à Payer</span>
                      <span className="text-2xl font-black text-primary font-mono">
                        {formatFCFA(totalPrice)} <span className="text-xs font-normal text-on-surface-variant">FCFA</span>
                      </span>
                    </div>

                    <button
                      onClick={handleProceedToCheckout}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#0038A8] to-[#0D52D6] hover:from-[#002D8C] hover:to-[#0B4FD8] text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-[#0038A8]/20 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-[#4EED15]" />
                      <span>Commander via Wave / OM</span>
                    </button>
                  </div>
                )}

                {/* Trust guarantee */}
                <div className="bg-surface rounded-2xl p-3 text-[11px] text-on-surface-variant flex items-center gap-2 border border-outline-variant/20">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  <span>Paiement 100% sécurisé • QR Code unique envoyé instantanément</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
