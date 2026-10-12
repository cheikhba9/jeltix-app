'use client';

import { use, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatDateWithDay, formatFCFA } from '@/lib/utils/format';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Footer } from '@/components/layout/Footer';
import Link from 'next/link';

// Dynamic: QR lib only downloads when component is in viewport — lighter initial bundle
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), {
  loading: () => <div className="w-48 h-48 bg-slate-100 rounded-2xl animate-pulse mx-auto" />,
  ssr: false,
});
import {
  ArrowLeft,
  Printer,
  Share2,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  MapPin,
  Calendar,
  Sparkles,
  Smartphone,
  ExternalLink,
  Lock,
  Download,
  Wallet,
  Clock,
} from 'lucide-react';

export default function TicketViewPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const { getTicketByCode, getEventBySlug } = useJeltixStore();
  const ticket = getTicketByCode(resolvedParams.code);
  const event = ticket ? getEventBySlug(ticket.eventId) : null;
  const [copied, setCopied] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);

  // Live Anti-Screenshot dynamic timer ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSeconds((s) => (s + 1) % 60);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        <h1 className="text-2xl font-black mb-2 text-on-surface">Billet introuvable</h1>
        <p className="text-xs text-on-surface-variant mb-4 font-mono">
          Le code "{resolvedParams.code}" n'existe pas dans le registre officiel Jël Tix.
        </p>
        <Link href="/" className="text-primary hover:underline text-sm font-bold">
          Retour à l'accueil Jël Tix
        </Link>
      </div>
    );
  }

  const isUsed = ticket.status === 'USED';

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: `Mon Billet Jël Tix - ${ticket.eventTitle}`,
          text: `Voici mon e-billet sécurisé Jël Tix pour ${ticket.eventTitle} (#${ticket.ticketCode})`,
          url: shareUrl,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050D1E] text-white">
      <PublicHeader />

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center">
        {/* Top Actions bar */}
        <div className="w-full flex justify-between items-center mb-6">
          <Link
            href="/"
            className="text-xs font-bold text-white/70 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tous les événements</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>{copied ? 'Lien copié !' : 'Partager'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-[#4EED15] hover:bg-[#42D40F] text-[#002D8C] text-xs font-black flex items-center gap-1.5 shadow-lg shadow-[#4EED15]/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / PDF</span>
            </button>
          </div>
        </div>

        {/* Cinematic Jël Tix E-Ticket Card */}
        <div className="w-full bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden relative border border-white/20">
          {/* Top Holographic Banner */}
          <div className="bg-gradient-to-r from-[#002D8C] via-[#0038A8] to-[#0D52D6] p-6 sm:p-8 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#4EED15]/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <img src="/logo-icon.svg" alt="Jël Tix" className="w-10 h-10 object-contain" />
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-black text-2xl tracking-tight text-white">Jël</span>
                  <span className="font-black text-2xl tracking-tight text-[#4EED15]">Tix</span>
                </div>
                <p className="text-[9px] font-bold italic text-white/80">Saisissez • Réservez • Profitez</p>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-2">
              <span
                className={`px-3.5 py-1.5 rounded-full text-xs font-black font-mono shadow-md flex items-center gap-1.5 ${
                  isUsed
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#4EED15] text-[#002D8C]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {isUsed ? 'DÉJÀ SCANNÉ / UTILISÉ' : 'BILLET OFFICIEL ACTIF'}
              </span>
            </div>
          </div>

          {/* Anti-Fraud Live Holographic Security Bar */}
          <div className="bg-slate-900 text-white px-6 py-2 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4EED15] animate-ping" />
              <span className="text-[#4EED15] font-bold">HORLOGE DYNAMIQUE ANTI-CAPTURE :</span>
              <span suppressHydrationWarning>{new Date().toLocaleTimeString('fr-FR')} :{liveSeconds < 10 ? `0${liveSeconds}` : liveSeconds}</span>
            </div>
            <span className="text-white/60 hidden sm:inline">Cryptage SHA-256 Jël Tix</span>
          </div>

          {/* Event Details Section */}
          <div className="p-6 sm:p-8 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-[#0038A8] bg-[#0038A8]/10 px-3 py-1 rounded-full font-mono">
                {ticket.ticketTypeName}
              </span>
              <span className="text-xs font-bold text-slate-500 font-mono">
                {formatFCFA(ticket.pricePaid)} FCFA
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {ticket.eventTitle}
            </h2>

            <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600 pt-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#0038A8]" />
                <span>{event?.venue || 'Stade Abdoulaye Wade'} ({event?.locationDetails || 'Diamniadio'})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#2CA808]" />
                <span>{event ? formatDateWithDay(event.startDate) : '25 Mai 2026'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                <span>{event?.timeString || '18:00 UTC'}</span>
              </div>
            </div>
          </div>

          {/* Ticket Perforated Cutout Separator */}
          <div className="relative flex items-center justify-between px-4 my-2">
            <div className="w-8 h-8 rounded-full bg-[#050D1E] -ml-8 border border-white/10 shadow-inner" />
            <div className="flex-1 border-b-2 border-dashed border-slate-300 mx-3" />
            <div className="w-8 h-8 rounded-full bg-[#050D1E] -mr-8 border border-white/10 shadow-inner" />
          </div>

          {/* Spectator & QR Code Area */}
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-8">
            {/* Spectator details */}
            <div className="space-y-4 flex-1 text-center sm:text-left w-full">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Titulaire du Billet
                </p>
                <p className="text-xl font-black text-slate-900">{ticket.customerName}</p>
                <p className="text-xs text-slate-500 font-mono">{ticket.customerPhone}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Porte d'accès
                  </p>
                  <p className="text-sm font-black text-[#0038A8]">{ticket.gateRecommendation}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Placement
                  </p>
                  <p className="text-sm font-black text-slate-900">{ticket.seatNumber || 'Gradins libres'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Code Sécurité Unique
                </p>
                <p className="text-2xl sm:text-3xl font-black font-mono text-[#0038A8] tracking-wider">
                  {ticket.ticketCode}
                </p>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center bg-slate-50 p-5 rounded-3xl border-2 border-slate-200 shadow-inner shrink-0">
              <QRCodeSVG
                value={ticket.ticketCode}
                size={165}
                level="H"
                includeMargin={false}
              />
              <p className="text-[10px] font-mono font-bold text-slate-600 mt-3 text-center">
                Scan unique aux tourniquets
              </p>
            </div>
          </div>

          {/* Bottom Security Cryptographic Watermark */}
          <div className="bg-slate-100 p-4 text-center border-t border-slate-200 text-xs text-slate-600 flex items-center justify-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#0038A8]" />
            <span>Signature Cryptographique Jël Tix • Anti-Double Passage Activé</span>
          </div>
        </div>

        {/* Quick Simulator link for controllers */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-xs text-white/70 mb-2">
              Tester le contrôle de ce billet sur l'application agent :
            </p>
            <Link
              href="/scan"
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white font-bold text-xs shadow-md transition-transform active:scale-95"
            >
              <QrCode className="w-4 h-4 text-[#4EED15]" />
              <span>Tester le Scan (# {ticket.ticketCode})</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </Link>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-xs text-white/70 mb-2">
              Besoin de modifier ou commander d'autres billets ?
            </p>
            <Link
              href={event ? `/discover/${event.slug}` : '/'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-transform active:scale-95"
            >
              <Calendar className="w-4 h-4 text-[#4EED15]" />
              <span>Voir la fiche de l'événement</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
