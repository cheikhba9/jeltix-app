'use client';

import { useEffect, useState, useCallback } from 'react';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { formatFCFA, formatRelativeTime } from '@/lib/utils/format';
import { StatCard } from '@/components/ui/StatCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { LiveScansFeed } from '@/components/dashboard/LiveScansFeed';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Users,
  ArrowRight,
  Calendar,
  RefreshCw,
  Loader2,
  ShoppingBag,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  fetchPlatformKPIs,
  fetchOrganizerKPIs,
  type PlatformKPIs,
  type OrganizerKPIs,
} from '@/lib/services/analytics.service';

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, orders, events } = useJeltixStore();
  const role = currentUser?.role;
  const isAdmin = role === 'SUPER_ADMIN';
  const isOrganizer = role === 'ORGANIZER';
  const isSeller = role === 'SELLER';

  const [kpis, setKpis] = useState<PlatformKPIs | OrganizerKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirection automatique UNIQUEMENT pour les contrôleurs qui n'ont accès qu'au scanner
  useEffect(() => {
    if (role === 'CONTROLLER') {
      router.replace('/scan');
    }
  }, [role, router]);

  const loadKPIs = useCallback(async () => {
    if (!isAdmin && !isOrganizer && !isSeller) return;
    setLoading(true);
    try {
      if (isAdmin) {
        setKpis(await fetchPlatformKPIs());
      } else if (isOrganizer && currentUser?.id) {
        setKpis(await fetchOrganizerKPIs(currentUser.id));
      } else if (isSeller) {
        // KPIs pour le Vendeur : ses ventes au guichet + événements actifs
        const sellerOrders = currentUser?.id ? orders.filter((o) => o.sellerId === currentUser.id) : orders;
        const totalRevenue = sellerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalTicketsSold = sellerOrders.reduce(
          (sum, o) => sum + (o.items?.reduce((acc, it) => acc + it.quantity, 0) || 1),
          0
        );
        const activeEventsCount = events.filter((e) => e.status === 'PUBLISHED').length;

        setKpis({
          totalRevenue,
          revenueGrowth: 0,
          totalTicketsSold,
          ticketsGrowth: 0,
          activeEventsCount,
          successfulScansToday: 0,
          recentScans: [],
          hourlySales: [],
          topEvents: [],
        } as any);
      }
    } catch (err) {
      console.warn('Dashboard KPI load error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isOrganizer, isSeller, currentUser?.id, orders, events]);

  useEffect(() => {
    loadKPIs();
  }, [loadKPIs]);

  // Redirection en cours
  if (role === 'SELLER' || role === 'CONTROLLER') {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#0038A8] dark:text-[#4EED15]" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          Redirection vers votre espace de travail ({role === 'SELLER' ? 'Guichet Caisse POS' : 'Scanner Contrôleur'})…
        </p>
      </div>
    );
  }

  const totalRevenue = kpis?.totalRevenue ?? 0;
  const totalTicketsSold = kpis?.totalTicketsSold ?? 0;
  const activeEventsCount = kpis?.activeEventsCount ?? 0;
  const successfulScansToday = kpis?.successfulScansToday ?? 0;

  // Dernières commandes (5 max)
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="flex flex-col w-full gap-8">

      {/* ── Page header + refresh ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up stagger-1">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Tableau de bord
            {currentUser?.fullName && (
              <span className="text-[#0038A8] dark:text-[#4EED15]"> · {currentUser.fullName.split(' ')[0]}</span>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Vue d'ensemble en temps réel de la plateforme Jël Tix
          </p>
        </div>

        <button
          onClick={loadKPIs}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Actualiser
        </button>
      </div>

      {/* ── 4 KPI Stat Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-fade-up stagger-2">
        <StatCard
          title="Revenu Total"
          value={loading ? '—' : formatFCFA(totalRevenue)}
          unit="FCFA"
          iconName="payments"
          variant="primary"
          loading={loading}
        />
        <StatCard
          title="Billets Vendus"
          value={loading ? '—' : totalTicketsSold.toLocaleString('fr-FR')}
          iconName="confirmation_number"
          variant="tertiary"
          loading={loading}
        />
        <StatCard
          title="Événements Actifs"
          value={loading ? '—' : activeEventsCount}
          iconName="event"
          variant="primary"
          loading={loading}
        />
        <StatCard
          title="Scans Aujourd'hui"
          value={loading ? '—' : successfulScansToday.toLocaleString('fr-FR')}
          tag="Aujourd'hui"
          iconName="qr_code_scanner"
          variant="tertiary"
          loading={loading}
        />
      </div>

      {/* ── Analytics & Live Feed Row ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up stagger-3">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <div className="lg:col-span-1">
          <LiveScansFeed />
        </div>
      </div>

      {/* ── Quick Actions Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up stagger-4">
        {/* Créer un événement ou Ouvrir Guichet POS */}
        {isSeller ? (
          <Link
            href="/sales/pos"
            prefetch={true}
            className="bg-white dark:bg-[#0B1936] rounded-2xl p-6 shadow-xs flex flex-col justify-between group overflow-hidden relative min-h-[160px] border border-slate-200/90 dark:border-white/10 card-hover-glow"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-[#4EED15] flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Ouvrir le Guichet POS
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Encaissez les spectateurs et émettez des billets imprimables en temps réel.
                </p>
              </div>
            </div>
            <div className="relative z-10 flex justify-end mt-4">
              <span className="bg-[#4EED15] text-[#002D8C] font-black text-xs px-4 py-2.5 rounded-xl shadow-sm group-hover:bg-[#42D40F] transition-all inline-flex items-center gap-2">
                <span>Vendre au Guichet</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        ) : (
          <Link
            href="/events/new"
            prefetch={true}
            className="bg-white dark:bg-[#0B1936] rounded-2xl p-6 shadow-xs flex flex-col justify-between group overflow-hidden relative min-h-[160px] border border-slate-200/90 dark:border-white/10 card-hover-glow"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#0038A8]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0038A8]/10 dark:bg-[#0038A8]/20 text-[#0038A8] dark:text-[#4EED15] flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Créer un Événement
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Configurez un match, festival ou gala avec tarification et quotas.
                </p>
              </div>
            </div>
            <div className="relative z-10 flex justify-end mt-4">
              <span className="bg-[#0038A8] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm group-hover:bg-[#002D8C] group-hover:shadow-md transition-all inline-flex items-center gap-2">
                <span>Créer</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        )}

        {/* Admin → Gestion équipe | Vendeur → Consulter événements | Organisateur → Mes événements */}
        {currentUser?.role === 'SUPER_ADMIN' ? (
          <Link
            href="/users"
            prefetch={true}
            className="bg-white dark:bg-[#0B1936] rounded-2xl p-6 shadow-xs flex flex-col justify-between group overflow-hidden relative min-h-[160px] border border-slate-200/90 dark:border-white/10 card-hover-glow"
          >
            <div className="absolute inset-0 bg-gradient-to-bl from-slate-100/80 via-transparent to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Gestion Opérateurs & Rôles</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Supervisez organisateurs, contrôleurs et vendeurs de guichet.
                </p>
              </div>
            </div>
            <div className="relative z-10 flex justify-end mt-4">
              <span className="bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-bold text-xs px-4 py-2.5 rounded-xl group-hover:bg-slate-200 dark:group-hover:bg-white/20 transition-all inline-flex items-center gap-2 border border-slate-200 dark:border-white/10">
                <span>Gérer les équipes</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        ) : isSeller ? (
          <Link
            href="/events"
            prefetch={true}
            className="bg-white dark:bg-[#0B1936] rounded-2xl p-6 shadow-xs flex flex-col justify-between group overflow-hidden relative min-h-[160px] border border-slate-200/90 dark:border-white/10 card-hover-glow"
          >
            <div className="absolute inset-0 bg-gradient-to-bl from-blue-50/80 via-transparent to-transparent dark:from-blue-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-[#4EED15] flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Catalogue des Événements</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Consultez les événements en vente, vérifiez les jauges et les tarifs des billets.
                </p>
              </div>
            </div>
            <div className="relative z-10 flex justify-end mt-4">
              <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-[#4EED15] font-bold text-xs px-4 py-2.5 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-all inline-flex items-center gap-2 border border-blue-200 dark:border-blue-800/30">
                <span>Consulter les événements</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        ) : (
          <Link
            href="/events"
            prefetch={true}
            className="bg-white dark:bg-[#0B1936] rounded-2xl p-6 shadow-xs flex flex-col justify-between group overflow-hidden relative min-h-[160px] border border-slate-200/90 dark:border-white/10 card-hover-glow"
          >
            <div className="absolute inset-0 bg-gradient-to-bl from-emerald-50/80 via-transparent to-transparent dark:from-emerald-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-[#4EED15] flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Mes Événements</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Consultez vos événements actifs, ajustez les quotas et suivez les ventes.
                </p>
              </div>
            </div>
            <div className="relative z-10 flex justify-end mt-4">
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-[#4EED15] font-bold text-xs px-4 py-2.5 rounded-xl group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-all inline-flex items-center gap-2 border border-emerald-200 dark:border-emerald-800/30">
                <span>Voir mes événements</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* ── Dernières Commandes ────────────────────────────────── */}
      {recentOrders.length > 0 && (
        <div className="bg-white dark:bg-[#0B1936] rounded-2xl shadow-xs border border-slate-200/90 dark:border-white/10 overflow-hidden animate-fade-up stagger-5">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0038A8]/10 dark:bg-[#4EED15]/10 text-[#0038A8] dark:text-[#4EED15] flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">Dernières Commandes</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Transactions récentes</p>
              </div>
            </div>
            <Link
              href="/sales"
              prefetch={true}
              className="text-xs font-bold text-[#0038A8] dark:text-[#4EED15] hover:underline inline-flex items-center gap-1"
            >
              Voir tout <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-mono font-bold uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/5">
                  <th className="text-left px-6 py-3">Réf. Commande</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Méthode</th>
                  <th className="text-right px-6 py-3">Montant</th>
                  <th className="text-right px-6 py-3 hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order, idx) => (
                  <tr
                    key={order.id}
                    className={`border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/80 dark:hover:bg-white/3 transition-colors animate-fade-up stagger-${Math.min(idx + 1, 6)}`}
                  >
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-black font-mono text-[#0038A8] dark:text-[#4EED15]">
                        {order.reference}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                        {order.customerName}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {order.customerPhone}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {formatFCFA(order.totalAmount)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right hidden md:table-cell">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {formatRelativeTime(order.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Liens rapides terrain (Admin seulement) ───────────── */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up stagger-6">
          {[
            { href: '/sales/pos', icon: 'point_of_sale', label: 'Guichet POS', color: 'text-emerald-600 dark:text-[#4EED15] bg-emerald-50 dark:bg-emerald-950/30' },
            { href: '/scan', icon: 'qr_code_scanner', label: 'Scanner', color: 'text-[#0038A8] dark:text-[#4EED15] bg-blue-50 dark:bg-blue-950/30', external: true },
            { href: '/reports', icon: 'bar_chart', label: 'Rapports', color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30' },
            { href: '/users', icon: 'group', label: 'Utilisateurs', color: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              target={item.external ? '_blank' : undefined}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white dark:bg-[#0B1936] border border-slate-200/90 dark:border-white/10 hover:border-[#0038A8]/30 dark:hover:border-[#4EED15]/30 transition-all group card-hover-glow text-center"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform duration-200`}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
