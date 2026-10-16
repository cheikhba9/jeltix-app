'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA, formatDateWithDay } from '@/lib/utils/format';
import { playCashRegisterSound, playSuccessBeep } from '@/lib/audio/sound-effects';
import { PaymentMethod, Ticket } from '@/types';

// Dynamic import — QR code lib only loads when the payment success modal opens (~40KB saved on initial load)
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), {
  loading: () => <div className="w-32 h-32 bg-white/20 rounded-xl animate-pulse" />,
  ssr: false,
});

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
  };

  const clearCart = () => {
    setCart({});
    setCashTendered('');
  };

  const totalAmount = Object.values(cart).reduce((sum, item) => sum + item.qty * item.price, 0);
  const totalQuantity = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  const changeToReturn =
    typeof cashTendered === 'number' && cashTendered >= totalAmount
      ? cashTendered - totalAmount
      : 0;

  const handleCheckout = () => {
    if (totalAmount === 0 || !currentEvent) return;

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
      customerPhone: customerPhone || '+221 77 000 00 00',
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
      message: `${result.generatedTickets.length} billet(s) émis • ${formatFCFA(totalAmount)} FCFA`,
    });
    clearCart();
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

        {/* Event Quick Switcher */}
        <div className="w-full sm:w-auto">
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
              {publishedEvents.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title.length > 38 ? evt.title.substring(0, 38) + '...' : evt.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">
              Aucun événement actif
            </span>
          )}
        </div>
      </div>

      {/* Main POS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Event Tickets catalog & Quick Cash Pad */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Selected Event Card Banner */}
          {currentEvent && (
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
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5 font-mono">
                <Calculator className="w-4 h-4 text-primary" />
                <span>Calculateur Monnaie Reçue</span>
              </span>
              {typeof cashTendered === 'number' && cashTendered > 0 && (
                <button
                  onClick={() => setCashTendered('')}
                  className="text-[11px] font-bold text-error hover:underline cursor-pointer"
                >
                  Effacer
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CASH_DENOMINATIONS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCashTendered(val)}
                  className={`py-2 px-2 rounded-xl text-xs font-black font-mono border transition-transform active:scale-95 cursor-pointer text-center ${
                    cashTendered === val
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface hover:bg-surface-container-high text-on-surface border-outline-variant/30'
                  }`}
                >
                  {formatFCFA(val)}
                </button>
              ))}
            </div>

            {totalAmount > 0 && typeof cashTendered === 'number' && (
              <div className="mt-3 p-3 rounded-2xl bg-surface flex items-center justify-between border border-outline-variant/30">
                <div>
                  <p className="text-[10px] uppercase font-mono text-on-surface-variant">Montant Reçu</p>
                  <p className="text-base font-extrabold text-on-surface">{formatFCFA(cashTendered)} FCFA</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-mono text-on-surface-variant">Monnaie à Rendre</p>
                  <p className={`text-xl font-black ${changeToReturn >= 0 ? 'text-[#2CA808] dark:text-[#4EED15]' : 'text-error'}`}>
                    {changeToReturn >= 0 ? `${formatFCFA(changeToReturn)} FCFA` : 'Montant insuffisant'}
                  </p>
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
                disabled={totalAmount === 0}
                onClick={handleCheckout}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-transform active:scale-95 cursor-pointer ${
                  totalAmount > 0
                    ? 'bg-gradient-to-r from-[#2CA808] to-[#4EED15] text-[#002D8C] hover:opacity-95'
                    : 'bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Valider la Vente & Imprimer Reçu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 80mm Thermal Receipt Modal */}
      {showThermalReceipt && lastIssuedTickets && lastIssuedTickets.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#2CA808]" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono">
                  Reçu Caisse 80mm • Jël Tix
                </span>
              </div>
              <button
                onClick={() => setShowThermalReceipt(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Realistic Thermal Receipt Content */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 text-center font-mono space-y-3">
              <div>
                <p className="text-lg font-black tracking-tight text-[#0038A8]">JËL TIX BILLETTERIE</p>
                <p className="text-[10px] text-slate-500">Saisissez • Réservez • Profitez</p>
                <p className="text-[10px] text-slate-500">Opérateur : {currentUser?.fullName || 'Vendeur Guichet'}</p>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 text-left text-xs space-y-1">
                <p className="font-bold text-slate-900 line-clamp-1">{lastIssuedTickets[0].eventTitle}</p>
                <p className="text-[11px] text-slate-600">
                  {formatDateWithDay(currentEvent?.startDate || new Date().toISOString())}
                </p>
                <p className="text-[11px] text-slate-600">Client: {lastIssuedTickets[0].customerName}</p>
                <p className="text-[11px] text-slate-600">Mode: {selectedPayment}</p>
              </div>

              {/* Tickets generated in this order */}
              <div className="space-y-3 py-1">
                {lastIssuedTickets.map((tkt, idx) => (
                  <div key={tkt.id} className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center gap-2">
                    <div className="flex justify-between w-full text-xs font-bold">
                      <span className="text-[#0038A8]">{tkt.ticketTypeName}</span>
                      <span>{formatFCFA(tkt.pricePaid)} F</span>
                    </div>
                    <QRCodeSVG value={tkt.ticketCode} size={110} level="H" />
                    <p className="text-sm font-black tracking-widest text-[#0038A8]">{tkt.ticketCode}</p>
                    <p className="text-[10px] text-slate-500">{tkt.gateRecommendation}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 text-xs flex justify-between font-black">
                <span>TOTAL ENCAISSÉ :</span>
                <span className="text-[#0038A8]">
                  {formatFCFA(lastIssuedTickets.reduce((s, t) => s + t.pricePaid, 0))} FCFA
                </span>
              </div>

              <p className="text-[9px] text-slate-400">
                Merci de votre visite • Billet non remboursable • Anti-fraude Jël Tix
              </p>
            </div>

            {/* Print & Close Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-[#0038A8] text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#002D8C] cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4 text-[#4EED15]" />
                <span>Imprimer Reçu (80mm)</span>
              </button>
              <button
                onClick={() => setShowThermalReceipt(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
