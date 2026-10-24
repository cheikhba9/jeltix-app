'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA, formatDateWithDay, isEventClosedOrPast } from '@/lib/utils/format';
import { playCashRegisterSound, playSuccessBeep } from '@/lib/audio/sound-effects';
import { PaymentMethod, Ticket } from '@/types';
import { printThermal57x90 } from '@/lib/utils/thermal-print-57x90';

import { QRCodeSVG } from 'qrcode.react';

import Link from 'next/link';
import {
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Calendar,
  MapPin,
  X,
  Sparkles,
  Calculator,
  Lock,
  AlertTriangle,
  Ticket as TicketIcon,
} from 'lucide-react';

interface CartItem {
  ticketTypeId: string;
  name: string;
  price: number;
  qty: number;
}

import { useToast } from '@/components/ui/Toast';

const CASH_DENOMINATIONS = [500, 1000, 2000, 5000, 10000, 20000];

export default function POSPage() {
  const { events, purchaseTickets, currentUser } = useJeltixStore();
  const { addToast } = useToast();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrganizer = currentUser?.role === 'ORGANIZER';
  const isSeller = currentUser?.role === 'SELLER';
  const isAuthorized = isSuperAdmin || isOrganizer || isSeller;

  const scopedEvents = useMemo(() => {
    if (isSuperAdmin) return events;
    if (isOrganizer) {
      return events.filter((e) => e.organizerId === currentUser?.id);
    }
    if (isSeller) {
      const orgId = currentUser?.organizationId || currentUser?.id;
      return events.filter((e) => e.organizerId === orgId);
    }
    return [];
  }, [events, isSuperAdmin, isOrganizer, isSeller, currentUser]);

  const publishedEvents = useMemo(() => {
    return scopedEvents.filter((e) => e.status === 'PUBLISHED');
  }, [scopedEvents]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [selectedEventId, setSelectedEventId] = useState<string>('');

  useEffect(() => {
    if (publishedEvents.length > 0 && (!selectedEventId || !publishedEvents.some(e => e.id === selectedEventId))) {
      setSelectedEventId(publishedEvents[0].id);
    }
  }, [publishedEvents, selectedEventId]);

  const currentEvent = publishedEvents.find((e) => e.id === selectedEventId) || publishedEvents[0];
  const isCurrentEventClosed = isEventClosedOrPast(currentEvent);

  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('CASH');
  const [lastIssuedTickets, setLastIssuedTickets] = useState<Ticket[] | null>(null);
  const [showThermalReceipt, setShowThermalReceipt] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('Client Guichet');
  const [cashTendered, setCashTendered] = useState<number | ''>('');

  if (!mounted) return null;

  // Accès restreint : Seuls Super Admin et Vendeur (POS) peuvent opérer la caisse
  if (currentUser && !isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-on-surface mb-2">Accès Restreint au Guichet POS</h2>
        <p className="text-xs text-on-surface-variant max-w-md mb-6 leading-relaxed">
          Le module de vente physique et d'encaissement guichet est réservé aux Vendeurs (POS) et Super Administrateurs.
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-2"
        >
          <span>Retourner au Tableau de Bord</span>
        </Link>
      </div>
    );
  }

  const addToCart = (ticketTypeId: string, name: string, price: number) => {
    if (isCurrentEventClosed) {
      addToast({
        type: 'error',
        title: 'Événement Clôturé',
        message: 'Cet événement est terminé. Impossible d\'ajouter des billets au panier.',
      });
      return;
    }

    setCart((prev) => {
      const existing = prev[ticketTypeId] || { ticketTypeId, name, price, qty: 0 };
      return {
        ...prev,
        [ticketTypeId]: {
          ...existing,
          qty: existing.qty + 1,
        },
      };
    });

    setCashTendered('');
    playSuccessBeep();
    addToast({
      type: 'success',
      title: 'Ajouté au panier',
      message: `+1 ${name} (${formatFCFA(price)} FCFA)`,
      duration: 2000,
    });
  };

  const updateQuantity = (ticketTypeId: string, delta: number) => {
    setCart((prev) => {
      const item = prev[ticketTypeId];
      if (!item) return prev;
      const nextQty = item.qty + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[ticketTypeId];
        return next;
      }
      return {
        ...prev,
        [ticketTypeId]: { ...item, qty: nextQty },
      };
    });
    setCashTendered('');
  };

  const clearCart = () => {
    setCart({});
    setCashTendered('');
  };

  const totalAmount = Object.values(cart).reduce((sum, item) => sum + item.qty * item.price, 0);
  const totalQuantity = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  const isCashInsufficient =
    selectedPayment === 'CASH' &&
    totalAmount > 0 &&
    typeof cashTendered === 'number' &&
    cashTendered > 0 &&
    cashTendered < totalAmount;

  const changeToReturn =
    typeof cashTendered === 'number' && cashTendered >= totalAmount
      ? cashTendered - totalAmount
      : 0;

  const handleCheckout = () => {
    if (totalAmount === 0 || !currentEvent || isCurrentEventClosed) {
      if (isCurrentEventClosed) {
        addToast({
          type: 'error',
          title: 'Encaissement bloqué',
          message: 'Cet événement est terminé ou clôturé. La vente est impossible.',
        });
      }
      return;
    }

    if (isCashInsufficient) {
      addToast({
        type: 'error',
        title: 'Montant reçu insuffisant',
        message: `La somme reçue (${formatFCFA(cashTendered as number)} FCFA) ne couvre pas le total des billets (${formatFCFA(totalAmount)} FCFA).`,
      });
      return;
    }

    const items = Object.values(cart)
      .filter((item) => item.qty > 0)
      .map((item) => ({
        ticketTypeId: item.ticketTypeId,
        ticketTypeName: item.name,
        quantity: item.qty,
        unitPrice: item.price,
        subtotal: item.qty * item.price,
      }));

    const result = purchaseTickets({
      eventId: currentEvent.id,
      customerName: customerName || 'Client Guichet',
      customerPhone: customerPhone || '+221 76 402 74 68',
      items,
      paymentMethod: selectedPayment,
      channel: 'POS_GUICHET',
      sellerId: currentUser?.id,
    });

    playCashRegisterSound();
    setLastIssuedTickets(result.generatedTickets);
    setShowThermalReceipt(true);
    addToast({
      type: 'success',
      title: 'Vente Encaissée !',
      message: `${result.generatedTickets.length} billet(s) émis • Format 57×90mm`,
    });
    clearCart();

    // Lancement instantané de l'impression thermique 57x90mm (<150ms)
    setTimeout(() => {
      printThermal57x90({
        tickets: result.generatedTickets,
        event: currentEvent,
        sellerName: currentUser?.fullName || 'Vendeur Guichet',
        paymentMethod: selectedPayment,
      });
    }, 250);
  };

  const handlePrintThermal = () => {
    if (!lastIssuedTickets || lastIssuedTickets.length === 0) return;
    printThermal57x90({
      tickets: lastIssuedTickets,
      event: currentEvent,
      sellerName: currentUser?.fullName || 'Vendeur Guichet',
      paymentMethod: selectedPayment,
    });
  };

  return (
    <div className="flex flex-col w-full gap-6 pb-12">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4EED15] animate-pulse" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
              Guichet Caisse Express (POS)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Opérateur : {currentUser?.fullName || 'Vendeur Guichet'} • Session active • Encaissement instantané
          </p>
        </div>

        {/* Actions & Event Quick Switcher */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <Link
            href="/tickets"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-[#0038A8] dark:text-[#4EED15] font-bold text-xs border border-slate-200 dark:border-white/10 shadow-xs transition-all hover:scale-[0.99] active:scale-95 shrink-0"
            title="Retrouver les billets d'un client par code ou téléphone"
          >
            <TicketIcon className="w-4 h-4 text-[#2CA808] dark:text-[#4EED15]" />
            <span>Retrouver un billet perdu</span>
          </Link>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1 font-mono">
              Événement à Encaisser
            </label>
            {publishedEvents.length > 0 ? (
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setCart({});
                }}
                className="w-full sm:w-72 bg-surface text-on-surface text-xs font-bold py-2.5 px-3 rounded-xl border border-outline-variant/40 shadow-xs focus:ring-2 focus:ring-[#0038A8] outline-none cursor-pointer"
              >
                {publishedEvents.map((evt) => {
                  const closed = isEventClosedOrPast(evt);
                  return (
                    <option key={evt.id} value={evt.id}>
                      {evt.title.length > 30 ? evt.title.substring(0, 30) + '...' : evt.title}
                      {closed ? ' 🔒 [TERMINÉ]' : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                Aucun événement actif
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main POS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Event Tickets catalog & Quick Cash Pad */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Selected Event Card Banner */}
          {currentEvent && (
            <div className="space-y-3">
              {isCurrentEventClosed && (
                <div className="p-4 rounded-2xl bg-amber-500/20 border-2 border-amber-500 text-amber-950 dark:text-amber-100 flex items-center gap-3 shadow-md">
                  <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-extrabold uppercase tracking-wide">
                      Événement Terminé • Ventes Clôturées
                    </p>
                    <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 font-medium">
                      Cet événement est passé ou sa billetterie est fermée. Tout encaissement au guichet est bloqué.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-[#002D8C] to-[#0D52D6] rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-full bg-white/5 blur-xl pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-[#4EED15] text-[#002D8C] px-2.5 py-0.5 rounded-full font-mono">
                      {currentEvent.category}
                    </span>
                    <h2 className="text-lg sm:text-xl font-black mt-2 leading-tight">
                      {currentEvent.title}
                    </h2>
                    <p className="text-xs text-white/80 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#4EED15]" />
                      <span>{currentEvent.venue} ({currentEvent.locationDetails})</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 bg-white/10 p-3 rounded-2xl border border-white/15">
                    <p className="text-[10px] font-mono text-white/70 uppercase">Jauge Vendue</p>
                    <p className="text-base font-black text-[#4EED15]">
                      {currentEvent.soldCapacity.toLocaleString('fr-FR')} / {currentEvent.totalCapacity.toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Ticket Type Cards Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-mono">
              Catégories de Billets Disponibles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentEvent?.ticketTypes.map((tt) => {
                const countInCart = cart[tt.id]?.qty || 0;
                return (
                  <button
                    key={tt.id}
                    onClick={() => addToCart(tt.id, tt.name, tt.price)}
                    className={`relative rounded-2xl p-5 text-left border transition-all active:scale-95 group cursor-pointer flex flex-col justify-between min-h-[140px] ${
                      countInCart > 0
                        ? 'bg-[#0038A8]/10 border-[#0038A8] dark:bg-[#0038A8]/30 dark:border-[#4EED15]'
                        : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/30 hover:border-primary'
                    }`}
                  >
                    {countInCart > 0 && (
                      <span className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#0038A8] dark:bg-[#4EED15] text-white dark:text-[#002D8C] font-black text-xs flex items-center justify-center shadow-md">
                        {countInCart}
                      </span>
                    )}

                    <div>
                      <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-surface text-on-surface-variant">
                        {tt.badge || 'Standard'}
                      </span>
                      <h4 className="text-base font-extrabold text-on-surface mt-2 group-hover:text-primary transition-colors">
                        {tt.name}
                      </h4>
                      <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                        {tt.description}
                      </p>
                    </div>

                    <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-outline-variant/20">
                      <span className="text-xl font-black text-primary">
                        {formatFCFA(tt.price)}{' '}
                        <span className="text-xs font-bold text-on-surface-variant">FCFA</span>
                      </span>
                      <span className="text-[11px] font-bold text-tertiary">
                        + Ajouter
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Cash Calculator / Denomination Buttons */}
          <div className="bg-surface-container rounded-3xl p-5 border border-outline-variant/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5 font-mono">
                <Calculator className="w-4 h-4 text-primary" />
                <span>Calculateur Monnaie Reçue</span>
              </span>
              <div className="flex items-center gap-2">
                {totalAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setCashTendered(totalAmount)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                      cashTendered === totalAmount
                        ? 'bg-[#2CA808] text-white border-[#2CA808] shadow-xs'
                        : 'bg-surface hover:bg-surface-container-high text-primary border-primary/30'
                    }`}
                    title="Définir la monnaie reçue comme étant exactement le montant total"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Compte Exact ({formatFCFA(totalAmount)} F)</span>
                  </button>
                )}
                {typeof cashTendered === 'number' && cashTendered > 0 && (
                  <button
                    onClick={() => setCashTendered('')}
                    className="text-[11px] font-bold text-error hover:underline cursor-pointer"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CASH_DENOMINATIONS.map((val) => {
                const isUnderTotal = totalAmount > 0 && val < totalAmount;
                const isSelected = cashTendered === val;

                return (
                  <button
                    key={val}
                    type="button"
                    disabled={isUnderTotal}
                    onClick={() => setCashTendered(val)}
                    title={
                      isUnderTotal
                        ? `Montant inférieur au total de la commande (${formatFCFA(totalAmount)} FCFA)`
                        : `Encaisser ${formatFCFA(val)} FCFA`
                    }
                    className={`py-2 px-2 rounded-xl text-xs font-black font-mono border transition-all text-center ${
                      isUnderTotal
                        ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 line-through border-dashed border-outline-variant/20 shadow-none'
                        : isSelected
                        ? 'bg-primary text-on-primary border-primary shadow-sm cursor-pointer active:scale-95'
                        : 'bg-surface hover:bg-surface-container-high text-on-surface border-outline-variant/30 cursor-pointer active:scale-95'
                    }`}
                  >
                    {formatFCFA(val)}
                  </button>
                );
              })}
            </div>

            {totalAmount > 0 && typeof cashTendered === 'number' && cashTendered > 0 && (
              <div
                className={`mt-3 p-3 rounded-2xl bg-surface flex items-center justify-between border ${
                  cashTendered < totalAmount
                    ? 'border-error/50 bg-error/5'
                    : 'border-outline-variant/30'
                }`}
              >
                <div>
                  <p className="text-[10px] uppercase font-mono text-on-surface-variant">Montant Reçu</p>
                  <p className="text-base font-extrabold text-on-surface">{formatFCFA(cashTendered)} FCFA</p>
                </div>
                <div className="text-right">
                  {cashTendered < totalAmount ? (
                    <>
                      <p className="text-[10px] uppercase font-mono text-error font-bold flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Montant Insuffisant</span>
                      </p>
                      <p className="text-base font-black text-error">
                        Manque : -{formatFCFA(totalAmount - cashTendered)} FCFA
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] uppercase font-mono text-on-surface-variant">Monnaie à Rendre</p>
                      <p className="text-xl font-black text-[#2CA808] dark:text-[#4EED15]">
                        {formatFCFA(changeToReturn)} FCFA
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart, Customer Info & Payment Actions */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/30 shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div>
                <h3 className="text-lg font-black text-on-surface">Panier Guichet</h3>
                <p className="text-xs text-on-surface-variant">{totalQuantity} billet(s) sélectionné(s)</p>
              </div>
              {totalQuantity > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-error font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vider</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {Object.keys(cart).length === 0 ? (
                <div className="py-8 text-center text-on-surface-variant text-xs font-medium">
                  Le panier est vide. Cliquez sur un billet à gauche pour encaisser.
                </div>
              ) : (
                Object.values(cart).map((item) => (
                  <div
                    key={item.ticketTypeId}
                    className="bg-surface rounded-2xl p-3 flex items-center justify-between border border-outline-variant/20 shadow-2xs"
                  >
                    <div>
                      <p className="text-xs font-bold text-on-surface">{item.name}</p>
                      <p className="text-[11px] text-on-surface-variant font-mono">
                        {formatFCFA(item.price)} FCFA x {item.qty}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-surface-container-high rounded-xl p-1 border border-outline-variant/30">
                        <button
                          onClick={() => updateQuantity(item.ticketTypeId, -1)}
                          className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center text-xs font-black text-on-surface hover:bg-surface-container-highest cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-black text-xs text-on-surface font-mono">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.ticketTypeId, 1)}
                          className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center text-xs font-black text-on-surface hover:bg-surface-container-highest cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-sm font-black text-primary font-mono min-w-[70px] text-right">
                        {formatFCFA(item.qty * item.price)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Client Coordinates (Optional for faster counter sales) */}
            <div className="space-y-3 pt-2 border-t border-outline-variant/20">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant mb-1 font-mono uppercase">
                    Nom Client
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Client Guichet"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface border border-outline-variant/30 text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant mb-1 font-mono uppercase">
                    Tél (Optionnel SMS)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+221 77..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-surface border border-outline-variant/30 text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-2 border-t border-outline-variant/20">
              <label className="block text-[10px] font-bold text-on-surface-variant font-mono uppercase">
                Mode d'Encaissement
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayment('CASH')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedPayment === 'CASH'
                      ? 'bg-[#0038A8] text-white border-[#0038A8] shadow-md font-bold'
                      : 'bg-surface text-on-surface border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  <span className="text-[11px]">Espèces</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayment('WAVE')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedPayment === 'WAVE'
                      ? 'bg-[#1DC9FE] text-[#002D8C] border-[#1DC9FE] shadow-md font-black'
                      : 'bg-surface text-on-surface border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-[#1DC9FE]" />
                  <span className="text-[11px]">Wave QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPayment('ORANGE_MONEY')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedPayment === 'ORANGE_MONEY'
                      ? 'bg-[#FF7900] text-white border-[#FF7900] shadow-md font-bold'
                      : 'bg-surface text-on-surface border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-[#FF7900]" />
                  <span className="text-[11px]">Orange M.</span>
                </button>
              </div>
            </div>

            {/* Total & Checkout Button */}
            <div className="pt-4 border-t border-outline-variant/30 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-on-surface-variant">Total à Encaisser</span>
                <span className="text-3xl font-black text-primary font-mono">
                  {formatFCFA(totalAmount)}{' '}
                  <span className="text-sm font-normal text-on-surface-variant">FCFA</span>
                </span>
              </div>

              <button
                type="button"
                disabled={totalAmount === 0 || isCurrentEventClosed || isCashInsufficient}
                onClick={handleCheckout}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-transform active:scale-95 cursor-pointer ${
                  isCurrentEventClosed
                    ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-800 dark:text-amber-300 cursor-not-allowed'
                    : isCashInsufficient
                    ? 'bg-error/15 border-2 border-error text-error cursor-not-allowed'
                    : totalAmount > 0
                    ? 'bg-gradient-to-r from-[#2CA808] to-[#4EED15] text-[#002D8C] hover:opacity-95'
                    : 'bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed'
                }`}
              >
                {isCurrentEventClosed ? (
                  <>
                    <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <span>Événement Terminé (Vente Bloquée)</span>
                  </>
                ) : isCashInsufficient ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-error" />
                    <span>
                      Montant Reçu Insuffisant (Manque {formatFCFA(totalAmount - (cashTendered as number))} F)
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Valider la Vente & Imprimer Reçu</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 57mm x 90mm Thermal Receipt Modal */}
      {showThermalReceipt && lastIssuedTickets && lastIssuedTickets.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#2CA808] animate-pulse" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono">
                    Billet Thermique (57 × 90 mm)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Jël Tix POS • Impression Instantanée
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowThermalReceipt(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Realistic 57mm x 90mm Thermal Ticket Preview */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-dashed border-slate-400 text-center font-mono space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="pb-1 border-b border-dashed border-slate-300">
                <p className="text-base font-black tracking-tight text-[#0038A8]">JËL TIX</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase">Billetterie Officielle</p>
                <p className="text-[9px] text-slate-500">
                  Opérateur : {currentUser?.fullName || 'Vendeur Guichet'}
                </p>
              </div>

              {/* Each ticket formatted for 57x90mm */}
              <div className="space-y-4">
                {lastIssuedTickets.map((tkt, idx) => (
                  <div
                    key={tkt.id}
                    className="bg-white p-3.5 rounded-xl border-2 border-slate-300 flex flex-col items-center gap-2 shadow-xs text-left"
                  >
                    <div className="w-full text-center">
                      <p className="font-extrabold text-xs text-slate-900 line-clamp-1">{tkt.eventTitle}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {formatDateWithDay(currentEvent?.startDate || new Date().toISOString())} • {currentEvent?.timeString || '19:00'}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate">{currentEvent?.venue || 'Lieu Officiel'}</p>
                    </div>

                    <div className="w-full border-t border-dashed border-slate-300 pt-1.5 flex justify-between items-baseline">
                      <span className="text-xs font-black uppercase text-[#0038A8]">{tkt.ticketTypeName}</span>
                      <span className="text-xs font-black text-slate-900">{formatFCFA(tkt.pricePaid)} FCFA</span>
                    </div>

                    <div className="w-full text-[10px] text-slate-600 space-y-0.5">
                      <p className="truncate">Client : <strong>{tkt.customerName}</strong></p>
                      <div className="flex justify-between">
                        <span>Porte : <strong>{tkt.gateRecommendation || 'Accès Général'}</strong></span>
                        {tkt.seatNumber && <span>Place : <strong>{tkt.seatNumber}</strong></span>}
                      </div>
                    </div>

                    <div className="w-full border-t border-dashed border-slate-300 pt-2 flex flex-col items-center justify-center">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <QRCodeSVG
                          id={`thermal-qr-${tkt.ticketCode}`}
                          value={tkt.ticketCode}
                          size={120}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                      <p className="text-sm font-black tracking-widest text-[#0038A8] font-mono mt-1">
                        #{tkt.ticketCode}
                      </p>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                        Billet {idx + 1}/{lastIssuedTickets.length} • Scan Unique
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 text-xs flex justify-between font-black">
                <span>TOTAL ENCAISSÉ :</span>
                <span className="text-[#0038A8]">
                  {formatFCFA(lastIssuedTickets.reduce((s, t) => s + t.pricePaid, 0))} FCFA
                </span>
              </div>

              <p className="text-[8px] text-slate-400">
                Format d'impression : 57mm × 90mm • Scan unique tourniquet
              </p>
            </div>

            {/* Print & Close Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintThermal}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-[#0038A8] to-[#0D52D6] hover:from-[#002D8C] hover:to-[#0038A8] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                title="Lancer l'impression directe au format 57x90mm"
              >
                <Printer className="w-4 h-4 text-[#4EED15]" />
                <span>Imprimer Billet (57×90mm)</span>
              </button>

              {lastIssuedTickets[0]?.customerPhone && (
                <a
                  href={`https://api.whatsapp.com/send?phone=${lastIssuedTickets[0].customerPhone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(`Bonjour ${lastIssuedTickets[0].customerName}, voici votre reçu et vos billets pour ${lastIssuedTickets[0].eventTitle} : https://jeltix.sn/tickets/${lastIssuedTickets[0].ticketCode}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-xs flex items-center justify-center shadow-md transition-colors"
                  title="Envoyer le lien du billet au client par WhatsApp"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowThermalReceipt(false)}
                className="px-4 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden fallback print area for Ctrl+P */}
      {lastIssuedTickets && lastIssuedTickets.length > 0 && (
        <div id="thermal-print-area" className="hidden print:block text-black bg-white">
          {lastIssuedTickets.map((tkt, idx) => (
            <div
              key={`print-fallback-${tkt.id}`}
              style={{
                width: '57mm',
                height: '90mm',
                maxHeight: '90mm',
                padding: '2mm 3mm',
                boxSizing: 'border-box',
                pageBreakAfter: 'always',
                breakAfter: 'page',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'center',
                overflow: 'hidden',
                background: '#ffffff',
                color: '#000000',
              }}
            >
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '1px' }}>JËL TIX</div>
                <div style={{ fontSize: '7px', fontWeight: 700, color: '#333' }}>BILLETTERIE OFFICIELLE</div>
                <div style={{ fontSize: '10.5px', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden' }}>{tkt.eventTitle}</div>
                <div style={{ fontSize: '8px', color: '#222' }}>
                  {formatDateWithDay(currentEvent?.startDate || new Date().toISOString())} • {currentEvent?.timeString || '19:00'}
                </div>
                <div style={{ fontSize: '8px', color: '#222' }}>{currentEvent?.venue || 'Lieu Officiel'}</div>
              </div>

              <div style={{ width: '100%', borderBottom: '1px dashed #000', margin: '1mm 0' }} />

              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 900 }}>
                  <span style={{ textTransform: 'uppercase' }}>{tkt.ticketTypeName}</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatFCFA(tkt.pricePaid)} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#222', marginTop: '0.5mm' }}>
                  <span>Client: {tkt.customerName}</span>
                  <span>{selectedPayment}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#222' }}>
                  <span>Porte: {tkt.gateRecommendation || 'Accès Général'}</span>
                  {tkt.seatNumber && <span>Place: {tkt.seatNumber}</span>}
                </div>
              </div>

              <div style={{ width: '100%', borderBottom: '1px dashed #000', margin: '1mm 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <QRCodeSVG value={tkt.ticketCode} size={118} level="H" />
                <div style={{ fontSize: '12.5px', fontWeight: 900, letterSpacing: '2px', fontFamily: 'monospace', marginTop: '0.8mm' }}>
                  #{tkt.ticketCode}
                </div>
              </div>

              <div style={{ width: '100%', borderBottom: '1px dashed #000', margin: '1mm 0' }} />

              <div style={{ width: '100%', fontSize: '7.5px', color: '#222' }}>
                <div>Caisse: {currentUser?.fullName || 'Vendeur'} • {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ fontSize: '7px', fontWeight: 900, letterSpacing: '0.5px' }}>BILLET OFFICIEL • SCAN UNIQUE OBLIGATOIRE</div>
                <div style={{ fontSize: '7px', fontFamily: 'monospace' }}>{idx + 1} / {lastIssuedTickets.length}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
