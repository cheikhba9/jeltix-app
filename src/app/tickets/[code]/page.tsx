'use client';

import { use, useState, useEffect, useMemo } from 'react';
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

const QRCodeCanvas = dynamic(() => import('qrcode.react').then((m) => m.QRCodeCanvas), {
  ssr: false,
});

import {
  buildWhatsAppTicketMessage,
  buildWhatsAppUrl,
  formatWhatsAppPhone,
  generateTicketPhoto,
} from '@/lib/utils/ticket-share';

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
  Layers,
  ChevronRight,
  AlertTriangle,
  Image as ImageIcon,
  Phone,
  Send,
  Loader2,
} from 'lucide-react';

export default function TicketViewPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const { getTicketByCode, getEventBySlug, tickets } = useJeltixStore();
  
  const [selectedCode, setSelectedCode] = useState(resolvedParams.code);
  const [showAllQRCodes, setShowAllQRCodes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);

  // États WhatsApp & Photo
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [isGeneratingPhoto, setIsGeneratingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);

  // Synchronisation du code sélectionné si le paramètre change
  useEffect(() => {
    setSelectedCode(resolvedParams.code);
  }, [resolvedParams.code]);

  // Billet actif actuellement affiché
  const ticket = useMemo(() => {
    return getTicketByCode(selectedCode) || getTicketByCode(resolvedParams.code);
  }, [selectedCode, resolvedParams.code, getTicketByCode, tickets]);

  const event = ticket ? getEventBySlug(ticket.eventId) : null;

  // Pré-remplir le numéro WhatsApp avec le téléphone du client s'il est vide
  useEffect(() => {
    if (ticket?.customerPhone && !whatsappPhone) {
      setWhatsappPhone(ticket.customerPhone);
    }
  }, [ticket?.customerPhone, whatsappPhone]);

  // Billets compagnons de la même commande (achats groupés de 2, 3, 5 billets, etc.)
  const companionTickets = useMemo(() => {
    if (!ticket) return [];
    if (ticket.orderId) {
      const sameOrder = tickets.filter((t) => t.orderId === ticket.orderId);
      if (sameOrder.length > 0) return sameOrder;
    }
    if (ticket.customerPhone && ticket.eventId) {
      return tickets.filter(
        (t) => t.customerPhone === ticket.customerPhone && t.eventId === ticket.eventId
      );
    }
    return [ticket];
  }, [ticket, tickets]);

  // Live Anti-Screenshot dynamic timer ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSeconds((s) => (s + 1) % 60);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#050D1E] text-white">
        <h1 className="text-2xl font-black mb-2 text-white">Billet introuvable</h1>
        <p className="text-xs text-white/60 mb-4 font-mono">
          Le code "{resolvedParams.code}" n'existe pas ou est en cours de synchronisation.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-[#0038A8] text-white font-bold text-xs hover:bg-[#002D8C] transition-colors"
        >
          Retour à l'accueil Jël Tix
        </Link>
      </div>
    );
  }

  const isUsed = ticket.status === 'USED';

  // URLs WhatsApp dynamiques et formatées
  const currentTicketUrl = typeof window !== 'undefined' ? window.location.href : `https://jeltix.sn/tickets/${ticket.ticketCode}`;
  const whatsappMsg = buildWhatsAppTicketMessage(ticket, event ?? null, currentTicketUrl);
  const directWhatsAppUrl = buildWhatsAppUrl(whatsappPhone || ticket.customerPhone, whatsappMsg);
  const generalShareWhatsAppUrl = buildWhatsAppUrl('', whatsappMsg);

  // Téléchargement / Partage de la Photo HD du billet
  const handleDownloadPhoto = async () => {
    setIsGeneratingPhoto(true);
    try {
      const qrCanvas = document.getElementById(`ticket-qr-canvas-${ticket.ticketCode}`) as HTMLCanvasElement | null;
      const dataUrl = await generateTicketPhoto(ticket, event ?? null, qrCanvas);

      // Partage natif mobile si disponible (permet d'envoyer l'image directement dans WhatsApp)
      if (typeof navigator !== 'undefined' && navigator.canShare) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `Billet-JelTix-${ticket.ticketCode}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Mon e-Billet Jël Tix - ${ticket.eventTitle}`,
              text: `Voici mon e-billet sécurisé avec QR Code pour ${ticket.eventTitle} (#${ticket.ticketCode})`,
              files: [file],
            });
            setIsGeneratingPhoto(false);
            setPhotoSuccess(true);
            setTimeout(() => setPhotoSuccess(false), 3000);
            return;
          }
        } catch (e) {
          console.warn('Native share fallback to direct download:', e);
        }
      }

      // Téléchargement direct du fichier PNG dans la galerie
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Billet-JelTix-${ticket.ticketCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setPhotoSuccess(true);
      setTimeout(() => setPhotoSuccess(false), 3000);
    } catch (err) {
      console.error('Erreur génération photo du billet:', err);
    } finally {
      setIsGeneratingPhoto(false);
    }
  };

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
        <div className="w-full flex flex-wrap justify-between items-center gap-3 mb-6">
          <Link
            href="/"
            className="text-xs font-bold text-white/70 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tous les événements</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={directWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#25D366]/20 transition-all cursor-pointer"
              title="Envoyer ou partager sur WhatsApp"
            >
              <span className="material-symbols-outlined text-[17px]">chat</span>
              <span>WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleDownloadPhoto}
              disabled={isGeneratingPhoto}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer text-white"
              title="Télécharger l'image photo HD du billet"
            >
              {isGeneratingPhoto ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#4EED15]" />
              ) : (
                <ImageIcon className="w-4 h-4 text-[#4EED15]" />
              )}
              <span>{photoSuccess ? 'Photo enregistrée !' : 'Photo HD'}</span>
            </button>

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

        {/* ─── NOUVEAU : Sélecteur Multi-Billets si la commande contient plusieurs billets ─── */}
        {companionTickets.length > 1 && (
          <div className="w-full bg-[#0B1936] border border-white/15 rounded-2xl p-4 mb-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#4EED15]" />
                <span className="text-xs font-black uppercase tracking-wider text-white font-mono">
                  Commande Groupée ({companionTickets.length} Billets avec QR Codes distincts)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllQRCodes(!showAllQRCodes)}
                className="text-[11px] font-bold text-[#4EED15] hover:underline cursor-pointer"
              >
                {showAllQRCodes ? 'Masquer la vue globale' : 'Voir tous les QR Codes'}
              </button>
            </div>

            {/* Onglets rapides pour basculer d'un billet à l'autre */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {companionTickets.map((t, idx) => {
                const isSelected = t.ticketCode === ticket.ticketCode;
                const isTktUsed = t.status === 'USED';
                return (
                  <button
                    key={t.id || t.ticketCode}
                    type="button"
                    onClick={() => {
                      setSelectedCode(t.ticketCode);
                      setShowAllQRCodes(false);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono shrink-0 flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0038A8] text-white ring-2 ring-[#4EED15] shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/10'
                    }`}
                  >
                    <span>
                      Billet {idx + 1} ({t.ticketCode})
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isTktUsed ? 'bg-red-500' : 'bg-[#4EED15]'
                      }`}
                      title={isTktUsed ? 'Déjà scanné' : 'Actif'}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── VUE GLOBALE : TOUS LES QR CODES DE LA COMMANDE ─── */}
        {showAllQRCodes && companionTickets.length > 1 && (
          <div className="w-full bg-white text-slate-900 rounded-3xl p-6 mb-6 shadow-2xl border border-white/20 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <div>
                <h3 className="text-base font-black text-slate-900 font-mono uppercase tracking-wider">
                  Tous les QR Codes de la Commande
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Présentez chaque QR code individuellement aux tourniquets de contrôle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllQRCodes(false)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {companionTickets.map((t, idx) => {
                const isTktUsed = t.status === 'USED';
                return (
                  <div
                    key={t.id || t.ticketCode}
                    className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all ${
                      isTktUsed
                        ? 'bg-red-50/50 border-red-200 opacity-80'
                        : 'bg-slate-50 border-slate-200 hover:border-[#0038A8] shadow-xs'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xs font-black text-[#0038A8] font-mono">
                        Billet #{idx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono ${
                          isTktUsed
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isTktUsed ? 'DÉJÀ SCANNÉ' : 'ACTIF'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner">
                      <QRCodeSVG value={t.ticketCode} size={135} level="H" includeMargin={false} />
                    </div>

                    <div>
                      <p className="text-base font-black font-mono tracking-wider text-slate-900">
                        {t.ticketCode}
                      </p>
                      <p className="text-xs font-bold text-slate-600">{t.ticketTypeName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{t.gateRecommendation}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCode(t.ticketCode);
                        setShowAllQRCodes(false);
                      }}
                      className="w-full py-1.5 rounded-lg bg-[#0038A8]/10 hover:bg-[#0038A8]/20 text-[#0038A8] text-xs font-bold cursor-pointer transition-colors"
                    >
                      Afficher ce billet en grand
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Hidden QRCodeCanvas for generating High-Definition Photo */}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, pointerEvents: 'none' }}>
          <QRCodeCanvas
            id={`ticket-qr-canvas-${ticket.ticketCode}`}
            value={ticket.ticketCode}
            size={300}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* WhatsApp & Téléchargement Photo Haute Définition */}
        <div className="w-full mt-6 bg-gradient-to-br from-[#072412] via-[#051A10] to-[#040D1C] border border-[#25D366]/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#25D366]/30">
                <span className="material-symbols-outlined text-[26px]">chat</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">Recevoir ce Billet sur WhatsApp</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-[#25D366]/20 text-[#25D366] px-2 py-0.5 rounded-full font-mono">
                    Officiel
                  </span>
                </div>
                <p className="text-xs text-white/70 mt-0.5">
                  Recevez les détails complets (événement, heure, lieu, code) et la photo avec le QR Code scannable.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadPhoto}
              disabled={isGeneratingPhoto}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {isGeneratingPhoto ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#4EED15]" />
              ) : (
                <ImageIcon className="w-4 h-4 text-[#4EED15]" />
              )}
              <span>{photoSuccess ? 'Photo Enregistrée ✓' : 'Télécharger Photo HD (.png)'}</span>
            </button>
          </div>

          {/* Formulaire Numéro WhatsApp personnalisé */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-white/80 font-mono uppercase tracking-wider">
              Numéro de téléphone WhatsApp destinataire
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-[#25D366] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="Ex: +221 77 123 45 67"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border border-[#25D366]/30 text-xs font-mono font-bold text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <a
                href={directWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/30 transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Envoyer sur mon WhatsApp</span>
              </a>

              <a
                href={generalShareWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                title="Partager à un autre contact ou groupe"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager à un ami</span>
              </a>
            </div>
            <p className="text-[10px] text-white/50 italic">
              💡 Le message WhatsApp inclut automatiquement l'événement, l'heure, le lieu, le titulaire, le code unique et le lien sécurisé vers votre QR Code.
            </p>
          </div>
        </div>

        {/* Quick Simulator link for controllers */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-xs text-white/70 mb-2">
              Tester le contrôle de ce billet sur l'application agent :
            </p>
            <Link
              href={`/scan?code=${ticket.ticketCode}`}
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
