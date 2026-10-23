'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA } from '@/lib/utils/format';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import {
  Loader2,
  RefreshCw,
  CreditCard,
  Smartphone,
  Banknote,
  ShoppingBag,
  Lock,
  Search,
  Filter,
  Download,
  X,
  Eye,
  CheckCircle2,
  Receipt,
  User,
  Phone,
  Calendar,
  Layers,
  ArrowUpDown,
  Printer,
  ExternalLink,
  MessageCircle,
  Ticket as TicketIcon,
} from 'lucide-react';

const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), {
  ssr: false,
});

interface SupabaseOrder {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  event_id: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  channel: string;
  created_at: string;
  events: { title: string } | { title: string }[] | null;
}

const METHOD_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  WAVE: { label: 'Wave', color: '#1DC9FE', bg: 'rgba(29, 201, 254, 0.12)' },
  ORANGE_MONEY: { label: 'Orange Money', color: '#FF7900', bg: 'rgba(255, 121, 0, 0.12)' },
  FREE_MONEY: { label: 'Free Money', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.12)' },
  CASH: { label: 'Espèces (Guichet)', color: '#107c10', bg: 'rgba(16, 124, 16, 0.12)' },
};

export default function SalesPage() {
  const { currentUser } = useJeltixStore();
  const { addToast } = useToast();

  const isAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isOrganizer = currentUser?.role === 'ORGANIZER';
  const isSeller = currentUser?.role === 'SELLER';
  const isController = currentUser?.role === 'CONTROLLER';

  const [orders, setOrders] = useState<SupabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'ONLINE' | 'POS'>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<SupabaseOrder | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [orderTickets, setOrderTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [showThermalReceipt, setShowThermalReceipt] = useState(false);

  useEffect(() => {
    if (!selectedOrder) {
      setOrderTickets([]);
      setShowThermalReceipt(false);
      return;
    }
    const currentOrderId = selectedOrder.id;
    const currentOrderRef = selectedOrder.reference;
    let isMounted = true;
    async function fetchTickets() {
      setLoadingTickets(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('tickets')
          .select('id, ticket_code, price_paid, status, qr_data, gate_recommendation, ticket_types(name)')
          .or(`order_id.eq.${currentOrderId},order_id.eq.${currentOrderRef}`);
        if (!error && data && isMounted) {
          setOrderTickets(data);
        }
      } catch (err) {
        console.error('Erreur chargement billets commande:', err);
      } finally {
        if (isMounted) setLoadingTickets(false);
      }
    }
    fetchTickets();
    return () => {
      isMounted = false;
    };
  }, [selectedOrder]);

  const loadOrders = useCallback(async () => {
    if (isController) return;
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from('orders')
        .select('id, reference, customer_name, customer_phone, event_id, total_amount, payment_method, payment_status, channel, created_at, events (title)')
        .eq('payment_status', 'COMPLETED')
        .order('created_at', { ascending: false })
        .limit(200);

      if (isOrganizer && currentUser?.id) {
        const { data: orgEvents } = await supabase
          .from('events')
          .select('id')
          .eq('organizer_id', currentUser.id);
        const ids = (orgEvents ?? []).map((e: { id: string }) => e.id);
        if (ids.length === 0) {
          // Nouvel organisateur : strictement 0 commande
          setOrders([]);
          setLoading(false);
          return;
        }
        query = query.in('event_id', ids) as typeof query;
      } else if (isSeller) {
        const orgId = currentUser?.organizationId || currentUser?.id;
        const { data: orgEvents } = await supabase
          .from('events')
          .select('id')
          .eq('organizer_id', orgId);
        const ids = (orgEvents ?? []).map((e: { id: string }) => e.id);
        if (ids.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }
        query = query.in('event_id', ids) as typeof query;
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as SupabaseOrder[];
      setOrders(rows);
    } catch (err) {
      console.error('Sales load error:', err);
      addToast({
        type: 'error',
        title: 'Erreur de chargement',
        message: 'Impossible de synchroniser le registre des ventes Supabase.',
      });
    } finally {
      setLoading(false);
    }
  }, [isOrganizer, isSeller, isController, currentUser?.id, addToast]);

  useEffect(() => {
    if (isAdmin || isOrganizer || isSeller) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [loadOrders, isAdmin, isOrganizer, isSeller]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Channel filter
      if (channelFilter === 'POS' && ord.channel !== 'POS' && ord.channel !== 'POS_GUICHET') {
        return false;
      }
      if (channelFilter === 'ONLINE' && (ord.channel === 'POS' || ord.channel === 'POS_GUICHET')) {
        return false;
      }

      // Method filter
      if (methodFilter !== 'ALL' && ord.payment_method !== methodFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const refMatch = ord.reference?.toLowerCase().includes(q);
        const nameMatch = ord.customer_name?.toLowerCase().includes(q);
        const phoneMatch = ord.customer_phone?.toLowerCase().includes(q);
        const eventTitle = Array.isArray(ord.events) ? ord.events[0]?.title : ord.events?.title;
        const titleMatch = eventTitle?.toLowerCase().includes(q);
        if (!refMatch && !nameMatch && !phoneMatch && !titleMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, channelFilter, methodFilter, searchQuery]);

  // Aggregate metrics on filtered list
  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  }, [filteredOrders]);

  const mobileMoneyRevenue = useMemo(() => {
    return filteredOrders
      .filter((o) => ['WAVE', 'ORANGE_MONEY', 'FREE_MONEY'].includes(o.payment_method))
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);
  }, [filteredOrders]);

  const cashRevenue = useMemo(() => {
    return filteredOrders
      .filter((o) => o.payment_method === 'CASH')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);
  }, [filteredOrders]);

  const avgOrderValue = useMemo(() => {
    return filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length) : 0;
  }, [totalRevenue, filteredOrders.length]);

  const mobileMoneyPct = totalRevenue > 0 ? Math.round((mobileMoneyRevenue / totalRevenue) * 100) : 0;

  // Export CSV
  const handleExportCSV = useCallback(() => {
    setIsExporting(true);
    try {
      if (filteredOrders.length === 0) {
        addToast({
          type: 'warning',
          title: 'Aucune commande',
          message: 'Aucune commande ne correspond aux filtres pour l\'exportation.',
        });
        return;
      }

      const headers = ['Référence', 'Client', 'Téléphone', 'Événement', 'Canal', 'Mode Paiement', 'Montant FCFA', 'Date ISO'];
      const rows = filteredOrders.map((o) => {
        const title = (Array.isArray(o.events) ? o.events[0]?.title : o.events?.title) || 'Événement';
        return [
          `"${o.reference}"`,
          `"${o.customer_name || 'Anonyme'}"`,
          `"${o.customer_phone || ''}"`,
          `"${title.replace(/"/g, '""')}"`,
          o.channel || 'ONLINE',
          o.payment_method,
          o.total_amount,
          new Date(o.created_at).toISOString(),
        ];
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `jeltix-ventes-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast({
        type: 'success',
        title: 'Export CSV Terminé',
        message: `${filteredOrders.length} commandes exportées avec succès.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de générer le fichier CSV.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [filteredOrders, addToast]);

  if (isController) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 ring-8 ring-amber-500/10">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-on-surface mb-1">Accès Restreint</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mb-5 leading-relaxed">
          Le registre des encaissements financiers est réservé aux Vendeurs Guichet, Organisateurs et Super Administrateurs.
        </p>
        <Link
          href="/scan"
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-2 shadow-md hover:scale-[0.98] transition"
        >
          <span>Accéder au Scanner Contrôleur</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-container/60 p-6 rounded-3xl border border-outline-variant/30 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1DC9FE] animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-primary">
              Flux Financier & Rapprochement
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">Gestion des Ventes & Recettes</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Encaissements en direct via Wave, Orange Money, Free Money et guichet comptoir POS.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={loadOrders}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold text-on-surface transition cursor-pointer disabled:opacity-40 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>Actualiser</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExporting || filteredOrders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold text-on-surface transition cursor-pointer disabled:opacity-40 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Exporter CSV</span>
          </button>

          <Link
            href="/sales/pos"
            className="bg-primary hover:bg-primary-hover text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-[18px] text-[#4EED15]">point_of_sale</span>
            <span>Ouvrir Guichet POS</span>
          </Link>
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider font-bold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-primary" /> Recettes Totales
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-primary font-mono mt-1">
            {loading ? '—' : `${formatFCFA(totalRevenue)}`}
            <span className="text-xs font-normal text-on-surface-variant ml-1 font-sans">FCFA</span>
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
            Panier moyen : {formatFCFA(avgOrderValue)} F
          </p>
        </div>

        {/* Total Completed Orders */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider font-bold flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-tertiary" /> Commandes Payées
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-tertiary font-mono mt-1">
            {loading ? '—' : filteredOrders.length.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-tertiary/80 font-mono mt-0.5">
            Paiements vérifiés
          </p>
        </div>

        {/* Mobile Money Share */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#1DC9FE]" /> Mobile Money
            </span>
            <span className="text-[10px] font-mono font-black text-[#1DC9FE] bg-[#1DC9FE]/10 px-2 py-0.5 rounded-full">
              {mobileMoneyPct}%
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-on-surface font-mono mt-1">
            {loading ? '—' : formatFCFA(mobileMoneyRevenue)}
            <span className="text-xs font-normal text-on-surface-variant ml-1 font-sans">FCFA</span>
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
            Wave & Orange Money
          </p>
        </div>

        {/* Cash share */}
        <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-on-surface-variant uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Espèces Guichet
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {loading ? '—' : formatFCFA(cashRevenue)}
            <span className="text-xs font-normal text-on-surface-variant ml-1 font-sans">FCFA</span>
          </p>
          <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
            Encaissements physiques
          </p>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/30 flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Réf (#ORD-), client, téléphone, titre…"
            className="w-full bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/60 text-xs pl-10 pr-8 py-2.5 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Channel & Method Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Channel selector */}
          <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded-xl border border-outline-variant/40 shrink-0">
            <button
              onClick={() => setChannelFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                channelFilter === 'ALL'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Tous canaux
            </button>
            <button
              onClick={() => setChannelFilter('ONLINE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                channelFilter === 'ONLINE'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              En ligne
            </button>
            <button
              onClick={() => setChannelFilter('POS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                channelFilter === 'POS'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Guichet POS
            </button>
          </div>

          {/* Payment Method Selector */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="bg-surface-container-high text-on-surface text-xs font-bold px-3 py-2 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none shrink-0 cursor-pointer"
          >
            <option value="ALL">Tous paiements</option>
            <option value="WAVE">Wave</option>
            <option value="ORANGE_MONEY">Orange Money</option>
            <option value="FREE_MONEY">Free Money</option>
            <option value="CASH">Espèces</option>
          </select>
        </div>
      </div>

      {/* Counter label */}
      <div className="flex items-center justify-between text-xs text-on-surface-variant px-1 font-mono">
        <span>
          <strong className="text-on-surface">{filteredOrders.length}</strong> commandes filtrées • Total :{' '}
          <strong className="text-primary">{formatFCFA(totalRevenue)} FCFA</strong>
        </span>
        {(channelFilter !== 'ALL' || methodFilter !== 'ALL' || searchQuery) && (
          <button
            onClick={() => {
              setChannelFilter('ALL');
              setMethodFilter('ALL');
              setSearchQuery('');
            }}
            className="text-primary hover:underline font-bold"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Orders — Vue Mobile (cards) */}
      <div className="md:hidden flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 bg-surface-container rounded-3xl border border-outline-variant/30">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs text-on-surface-variant font-mono">Chargement des commandes…</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-surface-container rounded-3xl p-8 text-center border border-outline-variant/30 flex flex-col items-center">
            <ShoppingBag className="w-8 h-8 text-on-surface-variant/40 mb-2" />
            <p className="text-sm font-bold text-on-surface">Aucune commande trouvée</p>
            <p className="text-xs text-on-surface-variant mt-1">
              Modifiez vos critères de recherche ou enregistrez des ventes au guichet POS.
            </p>
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const methodMeta = METHOD_LABELS[ord.payment_method] ?? {
              label: ord.payment_method,
              color: '#888',
              bg: 'rgba(136, 136, 136, 0.12)',
            };
            const isPos = ord.channel === 'POS' || ord.channel === 'POS_GUICHET';
            return (
              <div
                key={ord.id}
                onClick={() => setSelectedOrder(ord)}
                className="bg-surface-container rounded-2xl p-4 border border-outline-variant/30 space-y-2.5 active:scale-[0.99] transition cursor-pointer hover:border-outline-variant"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-black text-xs text-primary truncate">#{ord.reference}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-300 font-bold text-[10px] font-mono shrink-0">
                    PAYÉ
                  </span>
                </div>
                <div>
                  <p className="font-extrabold text-xs text-on-surface">{ord.customer_name || 'Client Inconnu'}</p>
                  <p className="text-[11px] text-on-surface-variant font-mono">{ord.customer_phone || 'Sans contact'}</p>
                </div>
                <p className="text-[11px] text-on-surface truncate">
                  {(Array.isArray(ord.events) ? ord.events[0]?.title : ord.events?.title) ?? 'Événement Jël Tix'}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                      {isPos ? 'GUICHET' : 'EN LIGNE'}
                    </span>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: methodMeta.color, backgroundColor: methodMeta.bg }}
                    >
                      {methodMeta.label}
                    </span>
                  </div>
                  <span className="font-black text-xs text-on-surface font-mono">{formatFCFA(ord.total_amount)} F</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Orders — Vue Desktop (table) */}
      <div className="hidden md:block bg-surface-container rounded-3xl border border-outline-variant/30 overflow-hidden shadow-sm">
        <div className="p-4 bg-surface-container-low border-b border-surface-container-high flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-on-surface">Registre des Commandes</h2>
            <span className="text-xs font-mono text-on-surface-variant">
              ({filteredOrders.length} enregistrements)
            </span>
          </div>
          <span className="text-xs font-mono text-tertiary bg-tertiary/10 px-2.5 py-0.5 rounded-full font-bold">
            Synchronisation Supabase Active
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs text-on-surface-variant font-mono">Chargement du journal des encaissements…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant border-b border-surface-container-high uppercase tracking-wider font-mono">
                  <th className="p-4">Référence</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Événement</th>
                  <th className="p-4">Canal</th>
                  <th className="p-4">Mode Paiement</th>
                  <th className="p-4 text-right">Montant</th>
                  <th className="p-4 text-center">Statut</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-on-surface-variant text-xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShoppingBag className="w-8 h-8 text-on-surface-variant/40" />
                        <p className="font-bold text-sm text-on-surface">Aucune commande trouvée</p>
                        <p className="text-xs text-on-surface-variant">
                          Aucun encaissement ne correspond à vos filtres de recherche.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => {
                    const methodMeta = METHOD_LABELS[ord.payment_method] ?? {
                      label: ord.payment_method,
                      color: '#888',
                      bg: 'rgba(136, 136, 136, 0.12)',
                    };
                    const isPos = ord.channel === 'POS' || ord.channel === 'POS_GUICHET';
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className="hover:bg-surface-container-highest/60 transition-colors cursor-pointer group"
                      >
                        <td className="p-4 font-mono font-black text-xs text-primary group-hover:underline">
                          #{ord.reference}
                        </td>
                        <td className="p-4">
                          <p className="font-extrabold text-on-surface">{ord.customer_name || 'Client Inconnu'}</p>
                          <p className="text-[11px] text-on-surface-variant font-mono">{ord.customer_phone || '—'}</p>
                        </td>
                        <td className="p-4 text-on-surface font-semibold truncate max-w-xs">
                          {(Array.isArray(ord.events) ? ord.events[0]?.title : ord.events?.title) ?? '—'}
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                            {isPos ? 'GUICHET POS' : 'EN LIGNE'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full inline-block"
                            style={{ color: methodMeta.color, backgroundColor: methodMeta.bg }}
                          >
                            {methodMeta.label}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-on-surface font-mono">
                          {formatFCFA(ord.total_amount)} FCFA
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950/80 text-green-700 dark:text-green-300 font-bold text-[10px] font-mono">
                            <CheckCircle2 className="w-3 h-3" /> PAYÉ
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(ord);
                            }}
                            className="p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition"
                            title="Inspecter le reçu"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Inspection Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl max-w-lg w-full border border-outline-variant/40 shadow-2xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-primary to-primary-container text-on-primary flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-lg">Reçu de Vente #{selectedOrder.reference}</h3>
                  <p className="text-xs text-white/80 font-mono">
                    {new Date(selectedOrder.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs">
              <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/30 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Client
                  </span>
                  <span className="font-bold text-on-surface">{selectedOrder.customer_name || 'Client Guichet'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Contact
                  </span>
                  <span className="font-mono text-on-surface">{selectedOrder.customer_phone || 'Non renseigné'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Événement
                  </span>
                  <span className="font-bold text-on-surface text-right truncate max-w-xs">
                    {(Array.isArray(selectedOrder.events) ? selectedOrder.events[0]?.title : selectedOrder.events?.title) || '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Canal de vente</span>
                  <span className="font-mono text-on-surface font-bold">
                    {selectedOrder.channel === 'POS' || selectedOrder.channel === 'POS_GUICHET' ? 'Guichet Physique POS' : 'Billetterie en ligne'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Mode de paiement</span>
                  <span className="font-bold text-on-surface">
                    {METHOD_LABELS[selectedOrder.payment_method]?.label || selectedOrder.payment_method}
                  </span>
                </div>
              </div>

              {/* Total amount highlight */}
              <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-on-surface-variant">Montant Total Réglé</p>
                  <p className="text-xl font-black text-primary font-mono">{formatFCFA(selectedOrder.total_amount)} FCFA</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-black text-[11px] font-mono">
                  ENCAISSÉ ✓
                </span>
              </div>

              {/* Billets associés à la commande */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <TicketIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Billets Émis ({orderTickets.length})</span>
                  </span>
                  {loadingTickets && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                </div>

                {orderTickets.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {orderTickets.map((t) => {
                      const typeName = Array.isArray(t.ticket_types)
                        ? t.ticket_types[0]?.name
                        : t.ticket_types?.name || 'Billet Standard';
                      return (
                        <div
                          key={t.id}
                          className="p-3 rounded-2xl bg-surface-container border border-outline-variant/30 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-primary tracking-wider">
                                {t.ticket_code}
                              </span>
                              <span
                                className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase font-mono ${
                                  t.status === 'VALID'
                                    ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {t.status === 'VALID' ? 'Valide' : t.status === 'USED' ? 'Scanné' : t.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                              {typeName} • {t.gate_recommendation || 'Accès Général'}
                            </p>
                          </div>

                          <Link
                            href={`/tickets/${t.ticket_code}`}
                            target="_blank"
                            className="px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
                            title="Voir le billet avec son QR Code"
                          >
                            <span>Voir</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                ) : !loadingTickets ? (
                  <p className="text-[11px] text-on-surface-variant italic p-2.5 bg-surface-container rounded-xl text-center">
                    Billet en cours de synchronisation ou archivé.
                  </p>
                ) : null}
              </div>

              {/* Partage WhatsApp au Client */}
              {selectedOrder.customer_phone && (
                <a
                  href={`https://wa.me/${selectedOrder.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Bonjour ${selectedOrder.customer_name || 'Client'}, voici votre reçu Jël Tix pour la commande #${selectedOrder.reference} (${formatFCFA(selectedOrder.total_amount)} FCFA).${
                      orderTickets[0]?.ticket_code
                        ? ` Votre billet : https://jeltix-sn.vercel.app/tickets/${orderTickets[0].ticket_code}`
                        : ''
                    }`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Envoyer au Client par WhatsApp</span>
                </a>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowThermalReceipt(true)}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-hover font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4 text-[#4EED15]" />
                  <span>Imprimer Reçu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface font-bold text-xs transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Impression Reçu Thermique 80mm */}
      {showThermalReceipt && selectedOrder && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-scale-in border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
                Aperçu Reçu d'Encaissement
              </span>
              <button
                type="button"
                onClick={() => setShowThermalReceipt(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 text-center font-mono space-y-3">
              <div>
                <p className="text-base font-black tracking-tight text-[#0038A8]">JËL TIX BILLETTERIE</p>
                <p className="text-[10px] text-slate-500">Saisissez • Réservez • Profitez</p>
                <p className="text-[10px] text-slate-400">Reçu officiel d'encaissement</p>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 text-left text-[11px] space-y-1">
                <p className="font-bold text-slate-900 truncate">
                  {(Array.isArray(selectedOrder.events) ? selectedOrder.events[0]?.title : selectedOrder.events?.title) || 'Événement'}
                </p>
                <p className="text-slate-600">Commande : #{selectedOrder.reference}</p>
                <p className="text-slate-600">Client : {selectedOrder.customer_name || 'Client'}</p>
                <p className="text-slate-600">Contact : {selectedOrder.customer_phone || 'N/A'}</p>
                <p className="text-slate-600">
                  Mode : {METHOD_LABELS[selectedOrder.payment_method]?.label || selectedOrder.payment_method}
                </p>
                <p className="text-slate-400 text-[10px]">
                  Date : {new Date(selectedOrder.created_at).toLocaleString('fr-FR')}
                </p>
              </div>

              {/* Tickets list with QR Code */}
              {orderTickets.length > 0 ? (
                <div className="space-y-2 py-1">
                  {orderTickets.map((t) => (
                    <div key={t.id} className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col items-center gap-1.5">
                      <div className="flex justify-between w-full text-[11px] font-bold">
                        <span className="text-[#0038A8]">
                          {Array.isArray(t.ticket_types) ? t.ticket_types[0]?.name : t.ticket_types?.name || 'Billet'}
                        </span>
                        <span>{formatFCFA(t.price_paid || 0)} F</span>
                      </div>
                      <QRCodeSVG value={t.ticket_code} size={90} level="M" />
                      <p className="text-xs font-black tracking-widest text-[#0038A8]">{t.ticket_code}</p>
                      <p className="text-[9px] text-slate-500">{t.gate_recommendation || 'Accès Standard'}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="border-t border-dashed border-slate-300 pt-2 text-xs flex justify-between font-black">
                <span>TOTAL ENCAISSÉ :</span>
                <span className="text-[#0038A8]">{formatFCFA(selectedOrder.total_amount)} FCFA</span>
              </div>

              <p className="text-[9px] text-slate-400">
                Anti-fraude Jël Tix • Billet valide sous réserve de scan unique à l'entrée
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-[#0038A8] hover:bg-[#002D8C] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#4EED15]" />
                <span>Lancer Impression (80mm)</span>
              </button>
              <button
                type="button"
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
