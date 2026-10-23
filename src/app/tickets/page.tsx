'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatDateFrench, formatDateWithDay, formatFCFA } from '@/lib/utils/format';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Footer } from '@/components/layout/Footer';
import { useToast } from '@/components/ui/Toast';
import dynamic from 'next/dynamic';
import {
  Ticket as TicketIcon,
  Search,
  QrCode,
  Calendar,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Filter,
  Download,
  Share2,
  Lock,
  DoorOpen,
  X,
} from 'lucide-react';
import type { Ticket } from '@/types';
import { isSuperAdminEmail } from '@/lib/services/profiles.service';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), {
  loading: () => <div className="w-40 h-40 bg-slate-100 dark:bg-white/10 rounded-2xl animate-pulse mx-auto" />,
  ssr: false,
});

export default function MyTicketsPage() {
  const { tickets, events, getTicketByCode, currentUser, setCurrentUser } = useJeltixStore();
  const { addToast } = useToast();

  // Instant local session recovery if not already in store
  useEffect(() => {
    if (!currentUser && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('jeltix_current_user_v2') || localStorage.getItem('jeltix_current_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.id) setCurrentUser(parsed);
        }
      } catch {}
    }
  }, [currentUser, setCurrentUser]);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || (currentUser?.email ? isSuperAdminEmail(currentUser.email) : false);
  const isOrganizer = currentUser?.role === 'ORGANIZER' && !isSuperAdmin;
  const isSeller = currentUser?.role === 'SELLER';
  const isStaff = isSuperAdmin || isOrganizer || isSeller;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState<'ALL' | string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'USED'>('ALL');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [devicePhone, setDevicePhone] = useState<string | null>(null);

  // Check saved customer details on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPhone = localStorage.getItem('jeltix_customer_phone');
      if (savedPhone) {
        setDevicePhone(savedPhone);
      }
    }
  }, []);

  // Événements accessibles selon les permissions strictes
  const availableEvents = useMemo(() => {
    if (isSuperAdmin) return events;
    if (isOrganizer && currentUser?.id) {
      return events.filter((e) => e.organizerId === currentUser.id);
    }
    if (isSeller) {
      const orgId = currentUser?.organizationId || currentUser?.id;
      return events.filter((e) => e.organizerId === orgId);
    }
    return [];
  }, [events, isSuperAdmin, isOrganizer, isSeller, currentUser]);

  // Billets strictement restreints selon les permissions :
  // - SUPER_ADMIN : Voit tous les billets de tous les événements
  // - ORGANISATEUR : Voit EXCLUSIVEMENT les billets des événements QU'IL A CRÉÉS
  // - VENDEUR : Voit EXCLUSIVEMENT les billets des événements créés par son organisateur
  // - PUBLIC / SPECTATEUR : Voit UNIQUEMENT ses propres billets
  const scopedTickets = useMemo(() => {
    // 1. Super Administrateur
    if (isSuperAdmin) {
      return tickets;
    }

    // 2. Organisateur : strictement ses propres événements créés
    if (isOrganizer && currentUser?.id) {
      const myEvents = events.filter((e) => e.organizerId === currentUser.id);
      const myEventIds = new Set(myEvents.map((e) => e.id));
      return tickets.filter((t) => myEventIds.has(t.eventId));
    }

    // 3. Vendeur : strictement les événements de son organisateur
    if (isSeller) {
      const orgId = currentUser?.organizationId || currentUser?.id;
      const myOrgEvents = events.filter((e) => e.organizerId === orgId);
      const myOrgEventIds = new Set(myOrgEvents.map((e) => e.id));
      return tickets.filter((t) => myOrgEventIds.has(t.eventId));
    }

    // 4. Client / Spectateur public : uniquement ses propres billets
    if (devicePhone) {
      const cleanDevice = devicePhone.replace(/\D/g, '');
      if (cleanDevice.length >= 5) {
        return tickets.filter((t) => (t.customerPhone || '').replace(/\D/g, '').includes(cleanDevice));
      }
    }

    return [];
  }, [tickets, events, isSuperAdmin, isOrganizer, isSeller, currentUser, devicePhone]);

  // Filter user tickets (matches status, event, code, title, name or phone)
  const filteredTickets = useMemo(() => {
    return scopedTickets.filter((t) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && t.status !== 'VALID') return false;
      if (statusFilter === 'USED' && t.status !== 'USED') return false;

      // Event filter
      if (selectedEventFilter !== 'ALL' && t.eventId !== selectedEventFilter) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cleanQueryPhone = q.replace(/\D/g, '');
        const cleanTicketPhone = (t.customerPhone || '').replace(/\D/g, '');

        const codeMatch = t.ticketCode.toLowerCase().includes(q);
        const eventMatch = t.eventTitle.toLowerCase().includes(q);
        const nameMatch = t.customerName.toLowerCase().includes(q);
        const phoneMatch = cleanQueryPhone.length >= 3 && cleanTicketPhone.includes(cleanQueryPhone);

        if (!codeMatch && !eventMatch && !nameMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [scopedTickets, statusFilter, selectedEventFilter, searchQuery]);

  const activeCount = scopedTickets.filter((t) => t.status === 'VALID').length;
  const usedCount = scopedTickets.filter((t) => t.status === 'USED').length;

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const clean = lookupCode.trim().toUpperCase();
    if (!clean) return;

    // Bassin de recherche : les billets autorisés selon le rôle
    const searchPool = isStaff ? scopedTickets : tickets;

    // 1. Recherche par code de billet
    const foundByCode = searchPool.find(
      (t) =>
        t.ticketCode.toUpperCase() === clean ||
        t.ticketCode.replace('JT-', 'FT-') === clean ||
        t.ticketCode.replace('FT-', 'JT-') === clean
    );

    if (foundByCode) {
      setSelectedTicket(foundByCode);
      setLookupCode('');
      addToast({
        type: 'success',
        title: 'Billet localisé !',
        message: `Billet #${foundByCode.ticketCode} (${foundByCode.customerName}) trouvé avec succès.`,
      });
      return;
    }

    // 2. Recherche par numéro de téléphone
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length >= 5) {
      const matchingTickets = searchPool.filter((t) =>
        (t.customerPhone || '').replace(/\D/g, '').includes(digitsOnly)
      );
      if (matchingTickets.length > 0) {
        setSearchQuery(lookupCode.trim());
        setLookupCode('');
        addToast({
          type: 'success',
          title: `${matchingTickets.length} billet(s) trouvé(s) !`,
          message: `Affichage des billets rattachés au numéro ${lookupCode}.`,
        });
        return;
      }
    }

    const notFoundMsg = isOrganizer
      ? `Aucun billet trouvé pour "${lookupCode}" sur vos événements créés.`
      : isSeller
      ? `Aucun billet trouvé pour "${lookupCode}" sur les événements de votre organisation.`
      : `Aucun billet trouvé pour "${lookupCode}". Vérifiez le code (ex: JT-...) ou le numéro.`;

    setLookupError(notFoundMsg);
    addToast({
      type: 'error',
      title: 'Introuvable',
      message: notFoundMsg,
    });
  };

  const getWhatsAppLink = (ticket: Ticket) => {
    const rawPhone = (ticket.customerPhone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 9 && !rawPhone.startsWith('221') ? `221${rawPhone}` : rawPhone;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://jeltix.sn';
    const msg = `🎟️ *Votre e-Billet Jël Tix*\n\n*Événement :* ${ticket.eventTitle}\n*Formule :* ${ticket.ticketTypeName}\n*Titulaire :* ${ticket.customerName}\n*Code Unique :* ${ticket.ticketCode}\n*Porte conseillée :* ${ticket.gateRecommendation || 'Porte Principale'}\n\n👉 Cliquez pour afficher votre QR Code d'accès :\n${origin}/tickets/${ticket.ticketCode}`;
    
    if (cleanPhone.length >= 8) {
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface selection:bg-[#4EED15] selection:text-[#002D8C]">
      <PublicHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Section */}
        <div className={`text-on-primary rounded-3xl p-6 sm:p-10 mb-8 shadow-xl relative overflow-hidden ${
          isStaff
            ? 'bg-gradient-to-br from-[#002D8C] via-[#0B4FD8] to-[#041A4E]'
            : 'bg-gradient-to-br from-primary via-primary-container to-[#001E5B]'
        }`}>
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-60 h-60 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-mono font-bold mb-4">
              <ShieldCheck className="w-4 h-4 text-[#4EED15]" />
              <span>
                {isSuperAdmin
                  ? 'Espace Administrateur • Registre Global des Billets'
                  : isOrganizer
                  ? 'Espace Organisateur • Support & Récupération Billets'
                  : isSeller
                  ? 'Espace Vendeur (Guichet) • Récupération Billets Clients'
                  : 'Portefeuille Sécurisé Jël Tix • Sénégal'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              {isStaff ? 'Recherche & Récupération de Billets' : 'Mes E-Billets & Accès'}
            </h1>
            <p className="text-sm sm:text-base text-on-primary/80 mt-2 leading-relaxed">
              {isStaff
                ? 'Un spectateur a égaré son billet ou son SMS ? Retrouvez immédiatement son accès par son numéro de téléphone ou son code de billet pour le lui renvoyer par WhatsApp ou lui afficher son QR code.'
                : 'Consultez vos QR codes anti-fraude hors-ligne, présentez-les aux tourniquets et profitez de vos événements préférés sans attente.'}
            </p>
          </div>
        </div>

        {/* Search & Code Lookup Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Search box for existing tickets */}
          <div className="lg:col-span-7 bg-surface-container rounded-2xl p-4 border border-outline-variant/30 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isStaff
                    ? "Rechercher par n° client (77...), nom ou code #JT-…"
                    : "Filtrer mes billets (#JT-, événement)…"
                }
                className="w-full bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/60 text-xs pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none transition"
              />
            </div>

            {/* Filter Pills & Event Switcher */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              {isStaff && availableEvents.length > 1 && (
                <select
                  value={selectedEventFilter}
                  onChange={(e) => setSelectedEventFilter(e.target.value)}
                  className="bg-surface-container-high text-on-surface text-xs font-bold py-2 px-3 rounded-xl border border-outline-variant/40 outline-none cursor-pointer max-w-[200px] truncate"
                >
                  <option value="ALL">Tous mes événements ({scopedTickets.length})</option>
                  {availableEvents.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title.length > 25 ? evt.title.substring(0, 25) + '...' : evt.title}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-xl border border-outline-variant/40">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Tous ({scopedTickets.length})
                </button>
                <button
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'ACTIVE'
                      ? 'bg-[#107c10] dark:bg-[#4EED15] text-white dark:text-[#002D8C] shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Actifs ({activeCount})
                </button>
                <button
                  onClick={() => setStatusFilter('USED')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === 'USED'
                      ? 'bg-slate-600 text-white shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Scannés ({usedCount})
                </button>
              </div>
            </div>
          </div>

          {/* Quick Ticket Lookup by Code or Phone */}
          <form
            onSubmit={handleLookup}
            className="lg:col-span-5 bg-surface-container rounded-2xl p-4 border border-outline-variant/30 flex flex-col justify-center"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Code billet (ex: JT-7777) ou n° téléphone…"
                className="flex-1 bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/60 text-xs px-3.5 py-2.5 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none font-mono"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary-hover text-on-primary px-4 py-2.5 rounded-xl font-bold text-xs shrink-0 transition flex items-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-[#4EED15]" />
                <span>Afficher</span>
              </button>
            </div>
            {devicePhone && !searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery(devicePhone)}
                className="mt-2 text-[11px] text-primary hover:underline font-mono flex items-center gap-1 text-left cursor-pointer"
              >
                <span>📱 Retrouver les billets rattachés à mon numéro ({devicePhone})</span>
              </button>
            )}
            {lookupError && (
              <p className="text-[11px] text-error font-medium mt-1.5">{lookupError}</p>
            )}
          </form>
        </div>

        {/* Tickets Grid */}
        {filteredTickets.length === 0 ? (
          <div className="bg-surface-container rounded-3xl p-10 sm:p-16 text-center border border-outline-variant/30 flex flex-col items-center justify-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <TicketIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-on-surface mb-2">
              {searchQuery ? 'Aucun billet correspondant' : 'Aucun billet dans votre registre'}
            </h2>
            <p className="text-xs sm:text-sm text-on-surface-variant mb-6 leading-relaxed">
              {searchQuery
                ? `La recherche "${searchQuery}" ne correspond à aucun billet émis pour vos événements. Vérifiez le numéro ou le code.`
                : isOrganizer
                ? 'Aucun billet n’a encore été vendu pour vos événements. Dès qu’une commande en ligne ou au guichet est finalisée pour l’un de vos événements créés, les billets apparaîtront ici.'
                : isSeller
                ? 'Aucun billet n’a encore été vendu pour les événements de votre organisation.'
                : isSuperAdmin
                ? 'Aucun billet n’a encore été émis sur la plateforme.'
                : 'Vous n’avez pas encore de billet dans votre portefeuille. Utilisez le champ ci-dessus pour rechercher vos billets par code ou par numéro de téléphone.'}
            </p>
            <Link
              href="/"
              className="bg-primary hover:bg-primary-hover text-on-primary px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-primary/25 hover:scale-[0.98] transition"
            >
              <Sparkles className="w-4 h-4 text-[#4EED15]" />
              <span>Explorer le Catalogue d'Événements</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTickets.map((t) => {
              const isUsed = t.status === 'USED';
              return (
                <div
                  key={t.id}
                  className={`rounded-3xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group ${
                    isUsed
                      ? 'bg-slate-100/90 dark:bg-slate-900/60 border-slate-300 dark:border-slate-800 opacity-65 grayscale-[0.9] hover:opacity-90 hover:grayscale-[0.4]'
                      : 'bg-surface-container border-outline-variant/30'
                  }`}
                >
                  {/* Ticket Header Banner */}
                  <div className={`p-4 text-white relative transition-colors ${
                    isUsed ? 'bg-slate-700 dark:bg-slate-800' : 'bg-gradient-to-r from-primary to-primary-container'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-xs ${
                        isUsed ? 'bg-black/30 text-slate-300' : 'bg-white/20 text-white'
                      }`}>
                        {t.ticketTypeName}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] font-mono ${
                        isUsed
                          ? 'bg-slate-800 text-slate-300 border border-slate-600'
                          : 'bg-[#4EED15] text-[#002D8C]'
                      }`}>
                        {isUsed ? 'DÉJÀ SCANNÉ' : 'VALIDE ✓'}
                      </span>
                    </div>
                    <h3 className={`font-extrabold text-base truncate pr-2 ${isUsed ? 'text-slate-300' : 'text-white'}`}>{t.eventTitle}</h3>
                    <p className={`text-[11px] font-mono mt-0.5 ${isUsed ? 'text-slate-400' : 'text-white/80'}`}>#{t.ticketCode}</p>
                  </div>

                  {/* Ticket Body with QR preview */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="flex items-center gap-4">
                      {/* Mini QR */}
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className={`p-2 rounded-2xl border shadow-xs shrink-0 transition cursor-pointer relative ${
                          isUsed
                            ? 'bg-slate-200 dark:bg-slate-800 border-slate-400/40 opacity-70'
                            : 'bg-white border-slate-200 hover:scale-105'
                        }`}
                        title={isUsed ? "Billet déjà scanné (Agrandir)" : "Agrandir le QR Code"}
                      >
                        <QRCodeSVG value={t.ticketCode} size={64} level="M" />
                        {isUsed && (
                          <div className="absolute inset-0 bg-slate-900/40 rounded-2xl flex items-center justify-center backdrop-blur-[0.5px]">
                            <span className="text-[8px] font-black uppercase tracking-wider text-white bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-600 font-mono -rotate-12">
                              UTILISÉ
                            </span>
                          </div>
                        )}
                      </button>

                      {/* Info Details */}
                      <div className="min-w-0 flex-1 space-y-1 text-xs">
                        <p className={`font-bold flex items-center gap-1.5 truncate ${isUsed ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-on-surface'}`}>
                          <DoorOpen className={`w-3.5 h-3.5 shrink-0 ${isUsed ? 'text-slate-400' : 'text-primary'}`} />
                          <span>{t.gateRecommendation || 'Porte Principale'}</span>
                        </p>
                        <p className="text-on-surface-variant text-[11px] font-mono flex items-center gap-1.5 truncate">
                          <Clock className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                          <span>{new Date(t.createdAt).toLocaleDateString('fr-FR')}</span>
                        </p>
                        <p className="text-on-surface-variant text-[11px] truncate">
                          Titulaire : <strong>{t.customerName}</strong>
                        </p>
                        {isUsed ? (
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                            <span>Statut :</span>
                            <span className="text-slate-600 dark:text-slate-300 uppercase">Déjà Scanné</span>
                          </p>
                        ) : t.customerPhone ? (
                          <p className="text-on-surface-variant text-[10px] font-mono truncate flex items-center gap-1 text-primary dark:text-[#4EED15]">
                            <span>Tél :</span>
                            <span className="font-bold">{t.customerPhone}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions bar */}
                    <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          isUsed
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                            : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'
                        }`}
                        title="Afficher le QR Code"
                      >
                        <QrCode className={`w-3.5 h-3.5 ${isUsed ? 'text-slate-500' : 'text-primary'}`} />
                        <span>{isUsed ? 'Voir Billet (Scanné)' : 'Voir QR'}</span>
                      </button>

                      <a
                        href={getWhatsAppLink(t)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`py-2.5 px-3 rounded-xl text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm ${
                          isUsed ? 'bg-slate-600 hover:bg-slate-700' : 'bg-[#25D366] hover:bg-[#20BD5A]'
                        }`}
                        title={
                          t.customerPhone
                            ? `Envoyer le billet à ${t.customerPhone} par WhatsApp`
                            : "Partager ce billet sur WhatsApp"
                        }
                      >
                        <span className="material-symbols-outlined text-[17px]">chat</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/tickets/${t.ticketCode}`;
                          navigator.clipboard.writeText(url);
                          addToast({
                            type: 'success',
                            title: 'Lien copié !',
                            message: `Lien du billet #${t.ticketCode} copié dans le presse-papier.`,
                          });
                        }}
                        className="py-2.5 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Copier le lien direct du billet"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <Link
                        href={`/tickets/${t.ticketCode}`}
                        className="py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold transition flex items-center justify-center gap-1"
                        title="Ouvrir la page officielle du billet"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* QR Code Inspection Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface text-on-surface rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-outline-variant/40 animate-scale-in text-center">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2 text-left">
                <span className={`w-3 h-3 rounded-full ${
                  selectedTicket.status === 'VALID' ? 'bg-[#4EED15] animate-pulse' : 'bg-slate-500'
                }`} />
                <div>
                  <h3 className={`font-extrabold text-sm truncate max-w-[220px] ${
                    selectedTicket.status === 'USED' ? 'text-slate-400 line-through' : 'text-on-surface'
                  }`}>
                    {selectedTicket.eventTitle}
                  </h3>
                  <p className="text-[10px] text-on-surface-variant font-mono">
                    {selectedTicket.ticketTypeName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Code Container */}
            <div className={`p-5 rounded-2xl border inline-block shadow-inner mx-auto relative ${
              selectedTicket.status === 'USED'
                ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 opacity-60 grayscale'
                : 'bg-white border-slate-200'
            }`}>
              <QRCodeSVG value={selectedTicket.ticketCode} size={180} level="H" />
              {selectedTicket.status === 'USED' && (
                <div className="absolute inset-0 bg-slate-900/50 rounded-2xl flex items-center justify-center backdrop-blur-[1px]">
                  <span className="text-sm font-black uppercase tracking-wider text-white bg-slate-800 px-3 py-1 rounded-lg border border-slate-600 font-mono -rotate-12 shadow-lg">
                    DÉJÀ SCANNÉ
                  </span>
                </div>
              )}
            </div>

            <div>
              <p className={`font-mono font-black text-xl tracking-widest ${
                selectedTicket.status === 'USED' ? 'text-slate-500 line-through' : 'text-primary'
              }`}>
                #{selectedTicket.ticketCode}
              </p>
              <p className="text-xs text-on-surface-variant mt-1 font-mono">
                {selectedTicket.gateRecommendation}
              </p>
            </div>

            <div className={`rounded-2xl p-3 border text-xs text-left space-y-1 ${
              selectedTicket.status === 'USED'
                ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-300 dark:border-slate-800'
                : 'bg-surface-container border-outline-variant/30'
            }`}>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Titulaire :</span>
                <span className="font-bold text-on-surface">{selectedTicket.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Statut :</span>
                <span className={`font-mono font-bold ${
                  selectedTicket.status === 'VALID' ? 'text-[#107c10] dark:text-[#4EED15]' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {selectedTicket.status === 'VALID' ? 'VALIDE ✓' : 'SCANNÉ / DÉJÀ UTILISÉ'}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={getWhatsAppLink(selectedTicket)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                  title="Envoyer sur WhatsApp"
                >
                  <span className="material-symbols-outlined text-[17px]">chat</span>
                  <span>WhatsApp</span>
                </a>
                <Link
                  href={`/tickets/${selectedTicket.ticketCode}`}
                  className="py-3 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-hover transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Plein Écran</span>
                </Link>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/tickets/${selectedTicket.ticketCode}`;
                    navigator.clipboard.writeText(url);
                    addToast({
                      type: 'success',
                      title: 'Lien copié !',
                      message: `Lien du billet #${selectedTicket.ticketCode} copié dans le presse-papier.`,
                    });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copier le lien</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant font-bold text-xs transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
